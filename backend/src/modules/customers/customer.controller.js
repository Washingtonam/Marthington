import Customer from "./customer.model.js";

import Sale from "../sales/sale.model.js";

const createCustomer =
  async (req, res) => {

    try {
      const normalizedPhone = req.body.phone
        ? Customer.normalizePhoneNumber(req.body.phone)
        : "";

      const customer =
        await Customer.create({
          ...req.body,
          phone: normalizedPhone || req.body.phone || "",
          phoneNormalized: normalizedPhone,
          business: req.user.businessId
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

      const customers =
        await Customer.find({
          business:
            req.user.businessId
        })

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

      const sales =
        await Sale.find({
          customer:
            customer._id
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