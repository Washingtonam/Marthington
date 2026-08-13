import mongoose from "mongoose";
import Invoice from "./invoice.model.js";
import InvoiceCounter from "./invoiceCounter.model.js";
import Product from "../products/product.model.js";
import Customer from "../customers/customer.model.js";
import Supplier from "../suppliers/supplier.model.js";
import InventoryMovement from "../inventory/inventory.model.js";
import BranchInventory from "../branches/branchInventory.model.js";
import Payment from "../payments/payment.model.js";
import EmailHistory from "../../models/emailHistory.model.js";
import { sendInvoiceCreatedEmail, sendPaymentReceivedEmail, sendInvoiceSharedEmail } from "../../utils/emailService.js";

const generateInvoiceNumber = async (businessId) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  let counter = await InvoiceCounter.findOne({ business: businessId });

  if (!counter) {
    counter = await InvoiceCounter.create({
      business: businessId,
      lastNumber: 0,
      prefix: "INV"
    });
  }

  // Increment counter
  counter.lastNumber += 1;
  await counter.save();

  // Format: INV-2024-01-000001
  const invoiceNumber = `${counter.prefix}-${year}-${month}-${String(counter.lastNumber).padStart(6, "0")}`;

  return invoiceNumber;
};

const calculatePaymentStatus = ({ totalAmount, amountPaid, returnedAmount = 0 }) => {
  const effectiveTotal = Math.max(0, totalAmount - returnedAmount);

  if (returnedAmount > 0 && amountPaid === 0 && effectiveTotal === 0) {
    return "Returned";
  }

  if (amountPaid >= effectiveTotal && effectiveTotal > 0) {
    return "Fully Paid";
  }

  if (amountPaid > 0 && amountPaid < effectiveTotal) {
    return "Partially Paid";
  }

  return "Unpaid";
};

const createInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      transactionType = "outgoing",
      customer,
      supplier,
      customerName,
      customerPhone,
      customerEmail,
      items = [],
      tax,
      discount,
      amountPaid = 0,
      dueDate,
      notes,
      invoiceType,
      branch
    } = req.body;

    const businessId = req.user.businessId;
    const branchId = branch || req.user.branchId || null;

    const subtotal = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const totalAmount = subtotal + Number(tax || 0) - Number(discount || 0);
    const returnedAmount = 0;
    const balanceDue = Math.max(0, totalAmount - Number(amountPaid || 0));
    const paymentStatus = calculatePaymentStatus({ totalAmount, amountPaid, returnedAmount });

    if (transactionType === "incoming" && !supplier) {
      throw new Error("Supplier must be provided for incoming supplier invoices.");
    }

    const processedItems = [];

    // Generate invoice number at the start
    const invoiceNumber = await generateInvoiceNumber(businessId);

    for (const item of items) {
      const invoiceItem = {
        product: item.product || null,
        name: item.name,
        quantity: Number(item.quantity || 0),
        price: Number(item.price || 0),
        total: Number(item.total || 0),
        returned: false,
        returnQuantity: 0,
        returnAmount: 0,
        receivedQuantity: transactionType === "incoming" ? Number(item.quantity || 0) : 0,
        soldQuantity: transactionType === "outgoing" ? Number(item.quantity || 0) : 0,
        supplierCreditStatus: transactionType === "incoming" ? "Unpaid" : null,
        supplierBatchLabel: transactionType === "incoming" ? "Supplier Credit - Unpaid" : ""
      };

      if (transactionType === "incoming" && item.product) {
        const product = await Product.findById(item.product).session(session);
        if (!product) {
          throw new Error(`Product not found for supplier item: ${item.name}`);
        }

        if (branchId) {
          const branchInventory = await BranchInventory.findOne({
            business: businessId,
            branch: branchId,
            product: product._id
          }).session(session);

          const previousStock = branchInventory ? branchInventory.quantity : 0;
          await BranchInventory.findOneAndUpdate(
            { business: businessId, branch: branchId, product: product._id },
            {
              $setOnInsert: {
                business: businessId,
                branch: branchId,
                product: product._id,
                createdBy: req.user.id
              },
              $inc: { quantity: invoiceItem.quantity }
            },
            { upsert: true, new: true, session }
          );

          await InventoryMovement.create(
            [
              {
                business: businessId,
                branch: branchId,
                product: product._id,
                type: "purchase",
                quantity: invoiceItem.quantity,
                previousStock,
                newStock: previousStock + invoiceItem.quantity,
                note: "Supplier credit received",
                createdBy: req.user.id
              }
            ],
            { session }
          );
        } else {
          const previousStock = product.stock;
          product.stock += invoiceItem.quantity;
          await product.save({ session });

          await InventoryMovement.create(
            [
              {
                business: businessId,
                product: product._id,
                type: "purchase",
                quantity: invoiceItem.quantity,
                previousStock,
                newStock: product.stock,
                note: "Supplier credit received",
                createdBy: req.user.id
              }
            ],
            { session }
          );
        }
      } else if (transactionType === "outgoing" && item.product) {
        // 🔥 HANDLE OUTGOING INVOICE STOCK DEDUCTION
        const product = await Product.findById(item.product).session(session);
        if (!product) {
          throw new Error(`Product not found for sale item: ${item.name}`);
        }

        if (branchId) {
          const branchInventory = await BranchInventory.findOne({
            business: businessId,
            branch: branchId,
            product: product._id
          }).session(session);

          const availableStock = branchInventory ? branchInventory.quantity : 0;
          if (availableStock < invoiceItem.quantity) {
            throw new Error(`Insufficient stock for ${product.name} at this branch. Available: ${availableStock}, Requested: ${invoiceItem.quantity}`);
          }

          const previousStock = availableStock;
          await BranchInventory.findOneAndUpdate(
            { business: businessId, branch: branchId, product: product._id },
            { $inc: { quantity: -invoiceItem.quantity } },
            { session }
          );

          await InventoryMovement.create(
            [
              {
                business: businessId,
                branch: branchId,
                product: product._id,
                type: "sale",
                quantity: invoiceItem.quantity,
                previousStock,
                newStock: previousStock - invoiceItem.quantity,
                note: `Sold via invoice ${invoiceNumber}`,
                createdBy: req.user.id
              }
            ],
            { session }
          );
        } else {
          if (product.stock < invoiceItem.quantity) {
            throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${invoiceItem.quantity}`);
          }

          const previousStock = product.stock;
          product.stock -= invoiceItem.quantity;
          await product.save({ session });

          await InventoryMovement.create(
            [
              {
                business: businessId,
                product: product._id,
                type: "sale",
                quantity: invoiceItem.quantity,
                previousStock,
                newStock: product.stock,
                note: `Sold via invoice ${invoiceNumber}`,
                createdBy: req.user.id
              }
            ],
            { session }
          );
        }
      }

      processedItems.push(invoiceItem);
    }

    const invoice = await Invoice.create(
      [
        {
          business: businessId,
          branch: branchId,
          createdBy: req.user.id,
          transactionType,
          customer,
          supplier,
          customerName,
          customerPhone,
          customerEmail,
          items: processedItems,
          subtotal,
          tax,
          discount,
          totalAmount,
          amountPaid: Number(amountPaid || 0),
          balance: balanceDue,
          balanceDue,
          returnedAmount,
          paymentStatus,
          dueDate,
          notes,
          invoiceType,
          invoiceNumber
        }
      ],
      { session }
    );

    const createdInvoice = invoice[0];

    if (transactionType === "outgoing" && customer) {
      const customerRecord = await Customer.findOne({ _id: customer, business: businessId }).session(session);
      if (customerRecord) {
        customerRecord.outstandingBalance += balanceDue;
        await customerRecord.save({ session });
      }
    }

    if (transactionType === "incoming" && supplier) {
      const supplierRecord = await Supplier.findOne({ _id: supplier, business: businessId }).session(session);
      if (!supplierRecord) {
        throw new Error("Supplier record not found for incoming supplier invoice.");
      }
    }

    await session.commitTransaction();
    session.endSession();

    const populatedInvoice = await Invoice.findById(createdInvoice._id)
      .populate("customer", "name phone email outstandingBalance")
      .populate("supplier", "name phone email isActive")
      .populate("business", "name email");

    // 📧 Send invoice created email (non-blocking)
    if (transactionType === "outgoing" && customerEmail) {
      setImmediate(() => {
        sendInvoiceCreatedEmail({
          recipientEmail: customerEmail,
          recipientName: customerName || "Valued Customer",
          businessName: populatedInvoice.business?.name || "Our Business",
          businessId: req.user.businessId,
          invoiceId: createdInvoice._id,
          invoiceNumber: invoiceNumber,
          customerName: customerName,
          amount: `$${totalAmount.toFixed(2)}`,
          dueDate: dueDate ? new Date(dueDate).toLocaleDateString() : "No due date",
          invoiceUrl: `${process.env.FRONTEND_URL}/invoices/${createdInvoice._id}`,
          createdBy: req.user.id
        }).catch(err => console.error("Email sending error:", err));
      });
    }

    res.json(populatedInvoice);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: err.message });
  }
};

const returnInvoiceItem = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { invoiceId } = req.params;
    const { itemId, returnQuantity = 0, reason = "Customer return" } = req.body;
    const invoice = await Invoice.findOne({ _id: invoiceId, business: req.user.businessId }).session(session);

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (invoice.transactionType !== "outgoing") {
      return res.status(400).json({ message: "Returns can only be processed against outgoing customer invoices." });
    }

    const item = invoice.items.id(itemId);
    if (!item) {
      return res.status(404).json({ message: "Invoice item not found" });
    }

    const availableReturn = item.quantity - item.returnQuantity;
    if (returnQuantity <= 0 || returnQuantity > availableReturn) {
      return res.status(400).json({ message: "Invalid return quantity." });
    }

    const returnAmount = returnQuantity * item.price;
    item.returned = true;
    item.returnQuantity += returnQuantity;
    item.returnAmount += returnAmount;

    invoice.returnedAmount += returnAmount;
    invoice.balanceDue = Math.max(0, invoice.balanceDue - returnAmount);
    invoice.balance = invoice.balanceDue;
    invoice.paymentStatus = calculatePaymentStatus({
      totalAmount: invoice.totalAmount,
      amountPaid: invoice.amountPaid,
      returnedAmount: invoice.returnedAmount
    });

    if (item.product) {
      const product = await Product.findById(item.product).session(session);
      if (product) {
        if (invoice.branch) {
          const branchInventory = await BranchInventory.findOne({
            business: req.user.businessId,
            branch: invoice.branch,
            product: product._id
          }).session(session);

          const previousStock = branchInventory ? branchInventory.quantity : 0;
          await BranchInventory.findOneAndUpdate(
            { business: req.user.businessId, branch: invoice.branch, product: product._id },
            {
              $setOnInsert: {
                business: req.user.businessId,
                branch: invoice.branch,
                product: product._id,
                createdBy: req.user.id
              },
              $inc: { quantity: returnQuantity }
            },
            { upsert: true, new: true, session }
          );

          await InventoryMovement.create(
            [
              {
                business: req.user.businessId,
                branch: invoice.branch,
                product: product._id,
                type: "return",
                quantity: returnQuantity,
                previousStock,
                newStock: previousStock + returnQuantity,
                note: `Returned from invoice ${invoice._id}: ${reason}`,
                createdBy: req.user.id
              }
            ],
            { session }
          );
        } else {
          const previousStock = product.stock;
          product.stock += returnQuantity;
          await product.save({ session });

          await InventoryMovement.create(
            [
              {
                business: req.user.businessId,
                product: product._id,
                type: "return",
                quantity: returnQuantity,
                previousStock,
                newStock: product.stock,
                note: `Returned from invoice ${invoice._id}: ${reason}`,
                createdBy: req.user.id
              }
            ],
            { session }
          );
        }
      }
    }

    if (invoice.customer) {
      const customerRecord = await Customer.findOne({ _id: invoice.customer, business: req.user.businessId }).session(session);
      if (customerRecord) {
        customerRecord.outstandingBalance = Math.max(0, customerRecord.outstandingBalance - returnAmount);
        await customerRecord.save({ session });
      }
    }

    await invoice.save({ session });
    await session.commitTransaction();
    session.endSession();

    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate("customer", "name phone email outstandingBalance")
      .populate("supplier", "name phone email isActive");

    res.json(populatedInvoice);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: err.message });
  }
};

const updateInvoicePayment = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { paymentAmount = 0, paymentMethod = "cash", referenceNumber = "", notes = "" } = req.body;

    const invoice = await Invoice.findOne({ _id: invoiceId, business: req.user.businessId });
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (paymentAmount <= 0) {
      return res.status(400).json({ message: "Payment amount must be greater than zero" });
    }

    invoice.amountPaid = Number(invoice.amountPaid || 0) + Number(paymentAmount || 0);
    invoice.balanceDue = Math.max(0, invoice.totalAmount - invoice.amountPaid - invoice.returnedAmount);
    invoice.balance = invoice.balanceDue;
    invoice.paymentStatus = calculatePaymentStatus({
      totalAmount: invoice.totalAmount,
      amountPaid: invoice.amountPaid,
      returnedAmount: invoice.returnedAmount
    });

    // Auto-update status to paid if fully paid
    if (invoice.balanceDue === 0 && invoice.status !== "paid") {
      invoice.status = "paid";
    } else if (invoice.balanceDue > 0 && invoice.amountPaid > 0 && invoice.status !== "overdue") {
      invoice.status = "partial";
    }

    await invoice.save();

    // 🔥 CREATE PAYMENT RECORD
    await Payment.create({
      business: req.user.businessId,
      invoice: invoiceId,
      paymentMethod,
      amount: Number(paymentAmount || 0),
      referenceNumber,
      notes,
      createdBy: req.user.id,
      status: "confirmed"
    });

    if (invoice.transactionType === "outgoing" && invoice.customer) {
      await Customer.findOneAndUpdate(
        { _id: invoice.customer, business: req.user.businessId },
        { $inc: { outstandingBalance: -Math.min(paymentAmount, invoice.amountPaid) } },
        { new: true }
      );
    }

    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate("customer", "name phone email outstandingBalance")
      .populate("supplier", "name phone email isActive")
      .populate("business", "name email");

    // 📧 Send payment received email (non-blocking)
    if (invoice.transactionType === "outgoing" && invoice.customerEmail) {
      setImmediate(() => {
        sendPaymentReceivedEmail({
          recipientEmail: invoice.customerEmail,
          recipientName: invoice.customerName || "Valued Customer",
          businessName: populatedInvoice.business?.name || "Our Business",
          businessId: req.user.businessId,
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          paymentAmount: `$${paymentAmount.toFixed(2)}`,
          paymentDate: new Date().toLocaleDateString(),
          remainingBalance: `$${invoice.balanceDue.toFixed(2)}`,
          invoiceUrl: `${process.env.FRONTEND_URL}/invoices/${invoice._id}`,
          createdBy: req.user.id
        }).catch(err => console.error("Email sending error:", err));
      });
    }

    res.json(populatedInvoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, business: req.user.businessId });
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const allowedFields = [
      "customerName",
      "customerPhone",
      "customerEmail",
      "dueDate",
      "notes",
      "status",
      "invoiceType",
      "tax",
      "discount",
      "items"
    ];

    const originalBalanceDue = invoice.balanceDue;
    const updates = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid invoice fields provided" });
    }

    Object.assign(invoice, updates);

    const subtotal = Array.isArray(invoice.items)
      ? invoice.items.reduce((sum, item) => sum + Number(item.total || 0), 0)
      : invoice.subtotal;

    invoice.subtotal = subtotal;
    invoice.totalAmount = subtotal + Number(invoice.tax || 0) - Number(invoice.discount || 0);
    invoice.balanceDue = Math.max(0, invoice.totalAmount - Number(invoice.amountPaid || 0) - Number(invoice.returnedAmount || 0));
    invoice.balance = invoice.balanceDue;
    invoice.paymentStatus = calculatePaymentStatus({
      totalAmount: invoice.totalAmount,
      amountPaid: invoice.amountPaid,
      returnedAmount: invoice.returnedAmount
    });

    await invoice.save();

    const balanceDiff = invoice.balanceDue - originalBalanceDue;
    if (invoice.transactionType === "outgoing" && invoice.customer && balanceDiff !== 0) {
      await Customer.findOneAndUpdate(
        { _id: invoice.customer, business: req.user.businessId },
        { $inc: { outstandingBalance: balanceDiff } },
        { new: true }
      );
    }

    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate("customer", "name phone email outstandingBalance")
      .populate("supplier", "name phone email isActive");

    res.json(populatedInvoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, business: req.user.businessId }).session(session);
    if (!invoice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (invoice.transactionType === "outgoing" && invoice.customer) {
      await Customer.findOneAndUpdate(
        { _id: invoice.customer, business: req.user.businessId },
        { $inc: { outstandingBalance: -invoice.balanceDue } },
        { new: true, session }
      );
    }

    if (invoice.transactionType === "incoming") {
      for (const item of invoice.items) {
        if (item.product && Number(item.receivedQuantity || 0) > 0) {
          if (invoice.branch) {
            const branchInventory = await BranchInventory.findOne({
              business: req.user.businessId,
              branch: invoice.branch,
              product: item.product
            }).session(session);

            if (branchInventory) {
              const previousStock = branchInventory.quantity;
              branchInventory.quantity = Math.max(0, branchInventory.quantity - Number(item.receivedQuantity || 0));
              await branchInventory.save({ session });

              await InventoryMovement.create(
                [
                  {
                    business: req.user.businessId,
                    branch: invoice.branch,
                    product: item.product,
                    type: "purchase_reversal",
                    quantity: Number(item.receivedQuantity || 0),
                    previousStock,
                    newStock: branchInventory.quantity,
                    note: `Reversed supplier invoice ${invoice._id}`,
                    createdBy: req.user.id
                  }
                ],
                { session }
              );
            }
          } else {
            const product = await Product.findById(item.product).session(session);
            if (product) {
              const previousStock = product.stock;
              product.stock = Math.max(0, product.stock - Number(item.receivedQuantity || 0));
              await product.save({ session });

              await InventoryMovement.create(
                [
                  {
                    business: req.user.businessId,
                    product: product._id,
                    type: "purchase_reversal",
                    quantity: Number(item.receivedQuantity || 0),
                    previousStock,
                    newStock: product.stock,
                    note: `Reversed supplier invoice ${invoice._id}`,
                    createdBy: req.user.id
                  }
                ],
                { session }
              );
            }
          }
        }
      }
    }

    await Invoice.deleteOne({ _id: invoice._id, business: req.user.businessId }).session(session);

    await session.commitTransaction();
    session.endSession();

    res.json({ success: true, id: invoice._id });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: err.message });
  }
};

const getInvoices = async (req, res) => {
  try {
    const query = { business: req.user.businessId };

    if (req.query.transactionType) {
      query.transactionType = req.query.transactionType;
    }

    if (req.query.paymentStatus) {
      query.paymentStatus = req.query.paymentStatus;
    }

    if (req.query.customerId) {
      query.customer = req.query.customerId;
    }

    if (req.query.supplierId) {
      query.supplier = req.query.supplierId;
    }

    if (req.query.returnedOnly === "true") {
      query["items.returned"] = true;
    }

    const invoices = await Invoice.find(query)
      .populate("customer", "name phone email outstandingBalance")
      .populate("supplier", "name phone email isActive")
      .sort({ createdAt: -1 });

    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getInvoiceById =
  async (req, res) => {

    try {

      const invoice =
        await Invoice.findById(
          req.params.id
        )

        .populate(
          "business"
        );

      if (!invoice) {

        return res.status(404).json({
          message:
            "Invoice not found"
        });
      }

      res.json(invoice);

    } catch (err) {

      res.status(500).json({
        message: err.message
      });

    }
  };

// 🔥 GET INVOICE FOR PDF GENERATION
const getInvoicePDF = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId)
      .populate("business", "name address phone email logo subscription")
      .populate("customer", "name phone email address")
      .populate("supplier", "name phone email address")
      .populate("items.product", "name price");

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Verify business ownership
    if (invoice.business._id.toString() !== req.user.businessId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Return invoice data with HTML template structure for PDF conversion
    const pdfData = {
      success: true,
      invoice: {
        ...invoice.toObject(),
        formattedDate: new Date(invoice.createdAt).toLocaleDateString(),
        formattedDueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "No due date",
        createdByName: invoice.createdBy?.name || "System",
      },
      template: "invoice", // Frontend can use this to select the right PDF template
    };

    res.json(pdfData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔥 SHARE INVOICE VIA EMAIL
const shareInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { recipientEmail, message = "" } = req.body;

    if (!recipientEmail || !recipientEmail.includes("@")) {
      return res.status(400).json({ message: "Valid recipient email is required" });
    }

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      business: req.user.businessId
    })
      .populate("business", "name email")
      .populate("customer", "name email");

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Send invoice share email
    const sent = await sendInvoiceSharedEmail({
      recipientEmail,
      recipientName: recipientEmail.split("@")[0], // Use email prefix as name if no name provided
      senderName: req.user.name || "Team Member",
      businessName: invoice.business?.name || "Our Business",
      businessId: req.user.businessId,
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      message,
      invoiceUrl: `${process.env.FRONTEND_URL}/invoices/${invoice._id}`,
      createdBy: req.user.id
    });

    if (!sent) {
      return res.status(500).json({ message: "Failed to send invoice email" });
    }

    res.json({
      success: true,
      message: `Invoice shared successfully with ${recipientEmail}`
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 📧 GET INVOICE EMAIL HISTORY
const getInvoiceEmailHistory = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    // Verify invoice belongs to user's business
    const invoice = await Invoice.findOne({
      _id: invoiceId,
      business: req.user.businessId
    });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Get email history for this invoice
    const emailHistory = await EmailHistory.find({
      invoice: invoiceId,
      business: req.user.businessId
    })
      .select("recipientEmail recipientName emailType status sentAt subject sharedMessage")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      invoiceNumber: invoice.invoiceNumber,
      emailHistory
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export default {
  createInvoice,
  updateInvoicePayment,
  updateInvoice,
  deleteInvoice,
  returnInvoiceItem,
  getInvoices,
  getInvoiceById,
  getInvoicePDF,
  shareInvoice,
  getInvoiceEmailHistory
};