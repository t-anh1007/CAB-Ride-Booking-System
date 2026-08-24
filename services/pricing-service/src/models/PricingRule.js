import mongoose from 'mongoose';

const pricingRuleSchema = new mongoose.Schema({
    vehicleType: { 
        type: String, 
        required: true, 
        unique: true,
        enum: ['bike', 'standard', 'premium', 'suv'] 
    },
    baseFare: { type: Number, required: true },  // Giá mở cửa (VD: 20000)
    perKm: { type: Number, required: true },     // Giá mỗi Km (VD: 10000)
    perMinute: { type: Number, required: true }  // Giá mỗi phút (VD: 2000)
}, { 
    timestamps: true 
});

export default mongoose.model('PricingRule', pricingRuleSchema);