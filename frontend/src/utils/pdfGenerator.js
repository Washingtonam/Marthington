import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * Generate Invoice PDF/JPG from invoice data
 * @param {Object} invoice - Invoice data object
 * @param {HTMLElement|string} elementOrId - Invoice element or its DOM ID
 * @param {string} fileName - Name for the downloaded file
 * @param {string} format - Output format: 'pdf' or 'jpg' (default: 'pdf')
 */
export const downloadInvoicePDF = async (invoice, elementOrId, fileName, format = 'pdf') => {
  let exportElement;

  try {
    const sourceElement = typeof elementOrId === "string"
      ? document.getElementById(elementOrId)
      : elementOrId;

    if (!sourceElement) {
      throw new Error("Invoice element not found");
    }

    const sourceRect = sourceElement.getBoundingClientRect();
    exportElement = sourceElement.cloneNode(true);
    exportElement.removeAttribute("id");
    exportElement.style.width = `${Math.ceil(sourceRect.width || 900)}px`;
    exportElement.style.maxWidth = "none";
    exportElement.style.maxHeight = "none";
    exportElement.style.overflow = "visible";

    const exportHost = document.createElement("div");
    exportHost.style.position = "fixed";
    exportHost.style.left = "-100000px";
    exportHost.style.top = "0";
    exportHost.style.width = `${Math.ceil(sourceRect.width || 900)}px`;
    exportHost.style.background = "#ffffff";
    exportHost.style.pointerEvents = "none";
    exportHost.appendChild(exportElement);
    document.body.appendChild(exportHost);

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const images = Array.from(exportElement.querySelectorAll("img"));
    await Promise.all(images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
    }));

    // Capture the invoice HTML as canvas
    const canvas = await html2canvas(exportElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: false,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");

    if (format === 'jpg') {
      const jpgCanvas = document.createElement("canvas");
      jpgCanvas.width = canvas.width;
      jpgCanvas.height = canvas.height;
      const context = jpgCanvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, jpgCanvas.width, jpgCanvas.height);
      context.drawImage(canvas, 0, 0);
      const jpgData = jpgCanvas.toDataURL("image/jpeg", 0.95);
      const link = document.createElement('a');
      link.href = jpgData;
      link.download = fileName?.replace(/\.pdf$/i, '.jpg') || `invoice-${invoice.invoiceNumber}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    }

    // Default: Export as PDF
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 20; // 10mm margins on each side
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 10; // Top margin

    // Add image to PDF, creating new pages if necessary
    pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - 20;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 20;
    }

    // Download the PDF
    pdf.save(fileName || `invoice-${invoice.invoiceNumber}.pdf`);
    return true;
  } catch (error) {
    console.error("Error generating document:", error);
    throw error;
  } finally {
    const exportHost = exportElement?.parentElement;
    if (exportHost) exportHost.remove();
  }
};

/**
 * Generate Invoice PDF using jsPDF with custom formatting
 * (Alternative method for more control over formatting)
 */
export const generateInvoicePDFFromData = (invoiceData) => {
  const {
    business,
    invoiceNumber,
    createdAt,
    customer,
    supplier,
    items,
    subtotal,
    tax,
    discount,
    totalAmount,
    amountPaid,
    balanceDue,
    dueDate,
    transactionType,
  } = invoiceData;

  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let yPosition = 15;

  // Header
  pdf.setFontSize(20);
  pdf.text("INVOICE", pageWidth / 2, yPosition, { align: "center" });

  yPosition += 15;
  pdf.setFontSize(10);

  // Business Info
  if (business) {
    pdf.text(`${business.name}`, 15, yPosition);
    yPosition += 5;
    if (business.address) pdf.text(`${business.address}`, 15, yPosition), (yPosition += 5);
    if (business.phone) pdf.text(`Phone: ${business.phone}`, 15, yPosition), (yPosition += 5);
    if (business.email) pdf.text(`Email: ${business.email}`, 15, yPosition), (yPosition += 5);
  }

  yPosition += 5;
  pdf.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 10;

  // Invoice Details
  pdf.setFontSize(9);
  pdf.text(`Invoice #: ${invoiceNumber}`, 15, yPosition);
  pdf.text(`Date: ${new Date(createdAt).toLocaleDateString()}`, pageWidth / 2, yPosition);
  yPosition += 6;
  pdf.text(`Type: ${transactionType === "outgoing" ? "Customer Invoice" : "Supplier Invoice"}`, 15, yPosition);
  if (dueDate) {
    pdf.text(`Due Date: ${new Date(dueDate).toLocaleDateString()}`, pageWidth / 2, yPosition);
  }

  yPosition += 12;

  // Customer/Supplier Info
  const counterparty = transactionType === "outgoing" ? customer : supplier;
  if (counterparty) {
    pdf.setFontSize(10);
    pdf.text(transactionType === "outgoing" ? "Bill To:" : "From:", 15, yPosition);
    yPosition += 5;
    pdf.setFontSize(9);
    pdf.text(`${counterparty.name}`, 15, yPosition);
    yPosition += 4;
    if (counterparty.email) {
      pdf.text(`Email: ${counterparty.email}`, 15, yPosition);
      yPosition += 4;
    }
    if (counterparty.phone) {
      pdf.text(`Phone: ${counterparty.phone}`, 15, yPosition);
      yPosition += 4;
    }
  }

  yPosition += 5;

  // Items Table
  const columns = ["Description", "Qty", "Price", "Amount"];
  const columnWidths = [80, 20, 30, 35];
  const startY = yPosition;

  // Table header
  pdf.setFillColor(240, 240, 240);
  let xPosition = 15;
  columns.forEach((col, index) => {
    pdf.text(col, xPosition, yPosition);
    xPosition += columnWidths[index];
  });

  yPosition += 7;
  pdf.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 5;

  // Table rows
  if (items && items.length > 0) {
    items.forEach((item) => {
      const itemName = item.name || "Item";
      const qty = item.quantity || 0;
      const price = item.price || 0;
      const amount = item.total || 0;

      xPosition = 15;
      pdf.text(itemName.substring(0, 25), xPosition, yPosition);
      xPosition += columnWidths[0];
      pdf.text(qty.toString(), xPosition, yPosition, { align: "right" });
      xPosition += columnWidths[1];
      pdf.text(`$${price.toFixed(2)}`, xPosition, yPosition, { align: "right" });
      xPosition += columnWidths[2];
      pdf.text(`$${amount.toFixed(2)}`, xPosition, yPosition, { align: "right" });

      yPosition += 6;

      // Check if we need a new page
      if (yPosition > pageHeight - 50) {
        pdf.addPage();
        yPosition = 15;
      }
    });
  }

  yPosition += 3;
  pdf.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 8;

  // Summary
  xPosition = pageWidth - 80;
  pdf.setFontSize(9);

  const summaryData = [
    { label: "Subtotal:", value: subtotal },
    { label: "Tax:", value: tax },
    { label: "Discount:", value: -discount },
    { label: "Total:", value: totalAmount, bold: true },
    { label: "Paid:", value: amountPaid },
    { label: "Balance Due:", value: balanceDue, bold: true },
  ];

  summaryData.forEach(({ label, value, bold }) => {
    if (bold) pdf.setFont(undefined, "bold");
    pdf.text(label, xPosition, yPosition);
    pdf.text(`$${Math.abs(value).toFixed(2)}`, pageWidth - 15, yPosition, { align: "right" });
    if (bold) pdf.setFont(undefined, "normal");
    yPosition += 6;
  });

  return pdf;
};
