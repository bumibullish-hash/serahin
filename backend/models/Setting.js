const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'usaha', unique: true },
    businessName: { type: String, default: 'Jasa Serahin', trim: true, maxlength: 80 },
    tagline: { type: String, default: 'Serahin aja, kami yang kerjakan', trim: true, maxlength: 120 },
    address: { type: String, default: '', trim: true, maxlength: 200 },
    phone: { type: String, default: '', trim: true, maxlength: 30 },
    email: { type: String, default: '', trim: true, maxlength: 100 },
    pickupHours: { type: String, default: 'Senin - Sabtu, 09.00 - 20.00 WIB', trim: true, maxlength: 100 },
    pickupPoints: { type: [String], default: ['WhatsApp', 'Email', 'Google Drive'] }
  },
  { timestamps: true }
);

settingSchema.statics.get = async function () {
  let setting = await this.findOne({ key: 'usaha' });
  if (!setting) {
    setting = await this.create({ key: 'usaha' });
  }
  return setting;
};

module.exports = mongoose.model('Setting', settingSchema);
