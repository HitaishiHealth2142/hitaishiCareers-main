require('dotenv').config();
const Razorpay = require('razorpay');

console.log('Key ID:', process.env.RAZORPAY_KEY_ID);
console.log('Key Secret:', process.env.RAZORPAY_KEY_SECRET ? 'Exists' : 'Missing');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const options = {
  amount: 49 * 100,
  currency: "INR",
  receipt: "test_receipt_1",
};

razorpay.orders.create(options)
  .then(order => {
    console.log('Order created successfully:', order);
  })
  .catch(err => {
    console.error('Error creating order:', err);
  });
