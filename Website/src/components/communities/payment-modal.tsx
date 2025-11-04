"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, IndianRupee } from "lucide-react";
import Script from "next/script";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  communityId: number;
  communityName: string;
  amount: number;
  onSuccess: () => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  communityId,
  communityName,
  amount,
  onSuccess,
}: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (isOpen && typeof window !== "undefined") {
      // Check if Razorpay is already loaded
      if (window.Razorpay) {
        setRazorpayLoaded(true);
      }
    }
  }, [isOpen]);

  const handlePayment = async () => {
    if (!razorpayLoaded) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Payment gateway is not loaded. Please try again.",
      });
      return;
    }

    setLoading(true);
    try {
      // Create order
      const response = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          communityId,
          amount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create payment order");
      }

      // Initialize Razorpay payment
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        amount: data.amount, // Amount in paise
        currency: data.currency,
        name: "ConnectSphere",
        description: `Join ${communityName}`,
        order_id: data.orderId,
        handler: async function (response: any) {
          // Verify payment
          const verifyResponse = await fetch("/api/payments/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              communityId,
            }),
          });

          const verifyData = await verifyResponse.json();

          if (!verifyResponse.ok) {
            toast({
              variant: "destructive",
              title: "Payment Failed",
              description: verifyData.error || "Payment verification failed",
            });
            setLoading(false);
            return;
          }

          toast({
            title: "Payment Successful!",
            description: "You have successfully joined the community.",
          });

          onSuccess();
          onClose();
          router.refresh();
        },
        prefill: {
          name: "",
          email: "",
          contact: "",
        },
        theme: {
          color: "#6366f1",
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
      setLoading(false);
    } catch (error: any) {
      console.error("Payment error:", error);
      toast({
        variant: "destructive",
        title: "Payment Error",
        description: error.message || "Failed to process payment",
      });
      setLoading(false);
    }
  };

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setRazorpayLoaded(true)}
        onError={() => {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to load payment gateway",
          });
        }}
      />
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Complete Payment</DialogTitle>
            <DialogDescription>
              Join {communityName} for ₹{amount.toFixed(0)}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-semibold">{communityName}</p>
                <p className="text-sm text-muted-foreground">Community Membership</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold flex items-center gap-1">
                  <IndianRupee className="h-5 w-5" />
                  {amount.toFixed(0)}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handlePayment} disabled={loading || !razorpayLoaded}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Pay Now"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

