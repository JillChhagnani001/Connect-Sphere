# Razorpay Payment Gateway Setup

This guide will help you set up Razorpay payment gateway for paid communities.

## Prerequisites

1. A Razorpay account (sign up at https://razorpay.com/)
2. Access to your Razorpay dashboard

## Setup Steps

### 1. Get Your Razorpay API Keys

1. Log in to your Razorpay Dashboard
2. Go to **Settings** → **API Keys**
3. Generate a new API key pair or use existing ones
4. Copy your **Key ID** and **Key Secret**

### 2. Configure Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# Razorpay Configuration
RAZORPAY_KEY_ID=your_key_id_here
RAZORPAY_KEY_SECRET=your_key_secret_here

# Public Key (for client-side)
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_key_id_here
```

**Important Notes:**
- Use **Test Keys** for development
- Use **Live Keys** for production
- Never commit your `.env.local` file to version control
- The `RAZORPAY_KEY_SECRET` should only be in server-side environment variables

### 3. Test Mode

For testing payments, use Razorpay's test mode:
- Test Key ID: Use your test key from Razorpay dashboard
- Test cards: Use Razorpay test cards (e.g., 4111 1111 1111 1111)
- Test mode will not charge real money

### 4. Webhook Setup (Optional but Recommended)

For production, set up webhooks to handle payment events:

1. Go to **Settings** → **Webhooks** in Razorpay Dashboard
2. Add webhook URL: `https://yourdomain.com/api/payments/webhook`
3. Select events: `payment.captured`, `payment.failed`
4. Copy the webhook secret

Add to `.env.local`:
```env
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

### 5. Database Schema

Make sure you have run the `communities_schema.sql` file which includes:
- `communities` table with `price` and `currency` fields
- `community_members` table with `payment_status` and `payment_date` fields

### 6. Testing the Integration

1. Create a paid community with a price (e.g., ₹100)
2. Click "Join (Paid)" button
3. Payment modal should open
4. Use test card: 4111 1111 1111 1111
5. Use any future expiry date
6. Use any CVV
7. Payment should complete successfully

## Payment Flow

1. User clicks "Join (Paid)" on a paid community
2. Payment modal opens with community details
3. User clicks "Pay Now"
4. System creates Razorpay order via `/api/payments/create-order`
5. Razorpay checkout modal opens
6. User completes payment
7. Payment is verified via `/api/payments/verify`
8. User membership is activated
9. User can access premium content

## Troubleshooting

### Payment modal doesn't open
- Check if Razorpay script is loaded
- Verify `NEXT_PUBLIC_RAZORPAY_KEY_ID` is set correctly
- Check browser console for errors

### Payment verification fails
- Verify `RAZORPAY_KEY_SECRET` is correct
- Check server logs for error messages
- Ensure signature verification is working

### Order creation fails
- Verify Razorpay API keys are correct
- Check if amount is in paise (multiplied by 100)
- Ensure community exists and user is authenticated

## Security Notes

- Never expose `RAZORPAY_KEY_SECRET` to the client
- Always verify payment signatures server-side
- Use HTTPS in production
- Implement proper error handling
- Log payment events for audit purposes

## Support

For Razorpay-specific issues, refer to:
- Razorpay Documentation: https://razorpay.com/docs/
- Razorpay Support: support@razorpay.com

