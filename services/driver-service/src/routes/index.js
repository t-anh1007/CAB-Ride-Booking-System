import express from "express";
import {
  getAvailableDrivers,
  getDriverById,
  patchDriver,
  goOnline,
  goOffline,
  updateLocation
} from "../controllers/driverController.js";

const router = express.Router();

router.get("/available", getAvailableDrivers);
router.get("/:driverId", getDriverById);
router.patch("/:driverId", patchDriver);
router.patch("/:driverId/location", updateLocation);
router.post("/:driverId/go-online", goOnline);
router.post("/:driverId/go-offline", goOffline);

// Internal Bootstrap Route (Called by auth-service)
router.post("/internal/drivers/bootstrap", async (req, res) => {
  const { subjectId, accountId } = req.body;
  // Minimal bootstrap for driver
  // In a real app, this would use a domain service/repository
  res.status(201).json({
    success: true,
    message: "Driver bootstrapped",
    data: { driverId: subjectId }
  });
});

export default router;
