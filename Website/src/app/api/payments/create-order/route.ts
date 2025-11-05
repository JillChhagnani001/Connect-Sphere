import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createServerClient } from '@/lib/supabase/server';

// Initialize Razorpay with proper error handling
let razorpay: Razorpay | null = null;

function getRazorpayInstance() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials are not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');
  }

  if (!razorpay) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  return razorpay;
}

export async function POST(request: NextRequest) {
  try {
    // Check Razorpay configuration first
    const razorpayInstance = getRazorpayInstance();

    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized. Please log in to continue.' }, { status: 401 });
    }

    const body = await request.json();
    const { communityId, amount } = body;

    if (!communityId || amount === undefined || amount === null) {
      return NextResponse.json({ 
        error: 'Missing required fields. Please provide communityId and amount.' 
      }, { status: 400 });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ 
        error: 'Invalid amount. Amount must be a positive number.' 
      }, { status: 400 });
    }

    // Verify community exists and get details
    const { data: community, error: communityError } = await supabase
      .from('communities')
      .select('*')
      .eq('id', communityId)
      .single();

    if (communityError || !community) {
      console.error('Community error:', communityError);
      return NextResponse.json({ 
        error: 'Community not found. Please check the community ID.' 
      }, { status: 404 });
    }

    // Check if already a member
    const { data: existingMember, error: memberCheckError } = await supabase
      .from('community_members')
      .select('*')
      .eq('community_id', communityId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (existingMember) {
      return NextResponse.json({ 
        error: 'You are already a member of this community.' 
      }, { status: 400 });
    }

    // Create Razorpay order
    // Generate a short receipt (max 40 chars for Razorpay)
    // Format: C{communityId}_{timestamp36}_{userIdFirst8}
    const timestamp36 = Date.now().toString(36);
    const userIdShort = user.id.substring(0, 8);
    let receipt = `C${communityId}_${timestamp36}_${userIdShort}`;
    
    // Ensure receipt doesn't exceed 40 characters
    if (receipt.length > 40) {
      // Fallback: use shorter format if still too long
      receipt = `${communityId}_${timestamp36}`.substring(0, 40);
    }

    const options = {
      amount: Math.round(amount * 100), // Convert to paise and ensure it's an integer
      currency: 'INR',
      receipt: receipt,
      notes: {
        community_id: communityId.toString(),
        user_id: user.id,
        community_name: community.name,
      },
    };

    try {
      const order = await razorpayInstance.orders.create(options);

      if (!order || !order.id) {
        throw new Error('Invalid response from Razorpay API');
      }

      return NextResponse.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
      });
    } catch (razorpayError: any) {
      console.error('Razorpay API error:', razorpayError);
      
      // Provide more specific error messages based on Razorpay error
      if (razorpayError.error?.description) {
        return NextResponse.json(
          { error: `Payment gateway error: ${razorpayError.error.description}` },
          { status: 500 }
        );
      }
      
      if (razorpayError.statusCode === 401) {
        return NextResponse.json(
          { error: 'Invalid Razorpay credentials. Please check your API keys.' },
          { status: 500 }
        );
      }

      throw razorpayError;
    }
  } catch (error: any) {
    console.error('Payment order creation error:', error);
    
    // Provide user-friendly error messages
    const errorMessage = error.message || 'Failed to create payment order';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}


