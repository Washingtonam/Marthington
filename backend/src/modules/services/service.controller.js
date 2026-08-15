import Service from "./service.model.js";
import { findCatalogMatch, mergeCatalogValues } from "../catalog/catalogUtils.js";

const findExistingServiceMatch = async (businessId, name, excludeId = null) => {
  if (!name || !String(name).trim()) return null;

  const query = { business: businessId };
  if (excludeId) query._id = { $ne: excludeId };

  const items = await Service.find(query).select("_id name price costPrice category isActive").lean();
  return findCatalogMatch(items, name);
};

// ========================================
// 🔥 CREATE SERVICE
// ========================================
const createService = async (req, res) => {
  try {

    const {
      name,
      category,
      price,
      costPrice,
      duration,
      description,
      code
    } = req.body;

    // 🔥 VALIDATION
    if (!name) {
      return res.status(400).json({
        message: "Service name is required"
      });
    }

    const existing = await findExistingServiceMatch(req.user.businessId, name);
    if (existing) {
      const merged = mergeCatalogValues(existing, {
        name,
        price: Number(price) || Number(existing.price) || 0,
        costPrice: Number(costPrice) || Number(existing.costPrice) || 0,
        category: category || existing.category || "General"
      });

      const service = await Service.findByIdAndUpdate(existing._id, {
        $set: {
          name: merged.name,
          category: merged.category || "General",
          price: Number(merged.price) || 0,
          costPrice: Number(merged.costPrice) || 0,
          duration: Number(duration) || Number(existing.duration) || 0,
          description: description || existing.description || "",
          code: code || existing.code || ""
        }
      }, { new: true });

      return res.status(200).json({ ...service.toObject(), merged: true, duplicateOf: existing._id });
    }

    const service =
      await Service.create({

        name: String(name).trim(),

        category:
          category || "General",

        price:
          Number(price) || 0,

        costPrice:
          Number(costPrice) || 0,

        duration:
          Number(duration) || 0,

        description:
          description || "",

        code:
          code || "",

        business:
          req.user.businessId
      });

    res.json(service);

  } catch (err) {

    res.status(500).json({
      message: err.message
    });

  }
};

// ========================================
// 🔥 GET SERVICES
// ========================================
const getServices = async (req, res) => {
  try {
    const {
      search,
      category,
      activeOnly
    } = req.query;

    const currentType = req.user?.industryType?.trim() || "retail";

    if (currentType === "school" || currentType === "hospital") {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const query = {
      business: req.user.businessId
    };

    // 🔥 SEARCH
    if (search) {
      query.name = {
        $regex: search,
        $options: "i"
      };
    }

    // 🔥 CATEGORY FILTER
    if (category) {
      query.category = category;
    }

    // 🔥 ACTIVE FILTER
    if (activeOnly === "true") {
      query.isActive = true;
    }

    const services = await Service.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const safeServices = services.map((s) => ({
      ...s,
      price: Number(s.price) || 0,
      sellingPrice: Number(s.price) || 0,
      costPrice: Number(s.costPrice) || 0
    }));

    // Return the array directly so frontend code that maps over the root response works
    return res.status(200).json(safeServices);
  } catch (err) {
    // On error, return an empty array to avoid frontend map crashes
    return res.status(200).json([]);
  }
};

// ========================================
// 🔥 GET SINGLE SERVICE
// ========================================
const getServiceById = async (
  req,
  res
) => {
  try {

    const service =
      await Service.findById(
        req.params.id
      );

    if (!service) {
      return res.status(404).json({
        message: "Service not found"
      });
    }

    // 🔥 SECURITY
    if (
      req.user.role !== "super_admin" &&
      service.business.toString() !==
        req.user.businessId
    ) {
      return res.status(403).json({
        message: "Unauthorized"
      });
    }

    res.json(service);

  } catch (err) {

    res.status(500).json({
      message: err.message
    });

  }
};

// ========================================
// 🔥 UPDATE SERVICE
// ========================================
const updateService = async (
  req,
  res
) => {
  try {

    const service =
      await Service.findById(
        req.params.id
      );

    if (!service) {
      return res.status(404).json({
        message: "Service not found"
      });
    }

    // 🔥 SECURITY
    if (
      req.user.role !== "super_admin" &&
      service.business.toString() !==
        req.user.businessId
    ) {
      return res.status(403).json({
        message: "Unauthorized"
      });
    }

    const {
      name,
      category,
      price,
      costPrice,
      duration,
      description,
      code,
      isActive
    } = req.body;

    if (name !== undefined) {
      const duplicate = await findExistingServiceMatch(req.user.businessId, name, req.params.id);
      if (duplicate) {
        const merged = mergeCatalogValues(duplicate, {
          name,
          price: Number(price ?? duplicate.price ?? 0),
          costPrice: Number(costPrice ?? duplicate.costPrice ?? 0),
          category: category || duplicate.category || "General"
        });
        await Service.findByIdAndUpdate(duplicate._id, {
          $set: {
            name: merged.name,
            category: merged.category || "General",
            price: Number(merged.price) || 0,
            costPrice: Number(merged.costPrice) || 0,
            duration: Number(duration ?? duplicate.duration ?? 0),
            description: description || duplicate.description || "",
            code: code || duplicate.code || ""
          }
        });

        return res.status(200).json({ ...duplicate, name: merged.name, merged: true });
      }
      service.name = String(name).trim();
    }

    service.category =
      category ??
      service.category;

    if (price !== undefined) {
      service.price =
        Number(price);
    }

    if (costPrice !== undefined) {
      service.costPrice =
        Number(costPrice);
    }

    if (duration !== undefined) {
      service.duration =
        Number(duration);
    }

    service.description =
      description ??
      service.description;

    service.code =
      code ?? service.code;

    if (isActive !== undefined) {
      service.isActive =
        Boolean(isActive);
    }

    await service.save();

    res.json(service);

  } catch (err) {

    res.status(500).json({
      message: err.message
    });

  }
};

// ========================================
// 🔥 TOGGLE ACTIVE STATUS
// ========================================
const toggleServiceStatus = async (
  req,
  res
) => {
  try {

    const service =
      await Service.findById(
        req.params.id
      );

    if (!service) {
      return res.status(404).json({
        message: "Service not found"
      });
    }

    // 🔥 SECURITY
    if (
      req.user.role !== "super_admin" &&
      service.business.toString() !==
        req.user.businessId
    ) {
      return res.status(403).json({
        message: "Unauthorized"
      });
    }

    service.isActive =
      !service.isActive;

    await service.save();

    res.json({
      message:
        service.isActive
          ? "Service activated"
          : "Service deactivated",

      service
    });

  } catch (err) {

    res.status(500).json({
      message: err.message
    });

  }
};

// ========================================
// 🔥 DELETE SERVICE
// ========================================
const deleteService = async (
  req,
  res
) => {
  try {

    const service =
      await Service.findById(
        req.params.id
      );

    if (!service) {
      return res.status(404).json({
        message: "Service not found"
      });
    }

    // 🔥 SECURITY
    if (
      req.user.role !== "super_admin" &&
      service.business.toString() !==
        req.user.businessId
    ) {
      return res.status(403).json({
        message: "Unauthorized"
      });
    }

    await service.deleteOne();

    res.json({
      message:
        "Service deleted"
    });

  } catch (err) {

    res.status(500).json({
      message: err.message
    });

  }
};

export default {

  createService,

  getServices,

  getServiceById,

  updateService,

  toggleServiceStatus,

  deleteService
};