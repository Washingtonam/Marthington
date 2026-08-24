import Customer from "./customer.model.js";

import Sale from "../sales/sale.model.js";
import { getScopedBranchQuery, resolveOperationalBranchId } from "../../utils/branchAccess.js";

const createCustomer =
  async (req, res) => {

    try {
      const normalizedPhone = req.body.phone
        ? Customer.normalizePhoneNumber(req.body.phone)
        : "";

      const branchId = resolveOperationalBranchId({ user: req.user, requestedBranchId: req.body.branch });
      if (branchId === undefined) {
        return res.status(403).json({ message: "You can only create customers for your assigned branch." });
      }

      const customer =
        await Customer.create({
          ...req.body,
          phone: normalizedPhone || req.body.phone || "",
          phoneNormalized: normalizedPhone,
          business: req.user.businessId,
          branch: branchId
        });

      res.json(customer);

    } catch (err) {

      res.status(500).json({
        message: err.message
      });

    }
  };

const getCustomers =
  async (req, res) => {

    try {

      const query = getScopedBranchQuery(req.user, req.user.businessId, req.query.branchId);
      if (!query) return res.status(403).json({ message: "You do not have access to these customers" });

      const customers = await Customer.find(query)

        .sort({
          createdAt: -1
        });

      res.json(customers);

    } catch (err) {

      res.status(500).json({
        message: err.message
      });

    }
  };

const getCustomerById =
  async (req, res) => {

    try {

      const customer =
        await Customer.findById(
          req.params.id
        );

      if (!customer) {

        return res.status(404).json({
          message:
            "Customer not found"
        });
      }

      const customerQuery = getScopedBranchQuery(req.user, req.user.businessId, customer.branch?.toString());
      if (!customerQuery) return res.status(403).json({ message: "You do not have access to this customer" });

      const sales =
        await Sale.find({
          customer:
            customer._id,
          ...(customerQuery.branch ? { branch: customerQuery.branch } : {})
        })

        .sort({
          createdAt: -1
        });

      res.json({
        customer,
        sales
      });

    } catch (err) {

      res.status(500).json({
        message: err.message
      });

    }
  };

export default {
  createCustomer,
  getCustomers,
  getCustomerById
};