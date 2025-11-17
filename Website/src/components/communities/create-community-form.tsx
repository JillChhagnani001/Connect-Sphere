"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { ShieldAlert, Plus } from "lucide-react";
import { createCommunity } from "@/app/communities/actions";

const formSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(50, "Name must be less than 50 characters"),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
  membership_type: z.enum(["free", "paid"]),
  price: z.string().optional(),
  avatar_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  cover_image_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
}).refine((data) => {
  if (data.membership_type === "paid") {
    return data.price && Number.parseFloat(data.price) > 0;
  }
  return true;
}, {
  message: "Price is required for paid communities",
  path: ["price"],
});

export function CreateCommunityForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      membership_type: "free",
      price: "",
      avatar_url: "",
      cover_image_url: "",
    },
  });

  const membershipType = form.watch("membership_type");
  const { profile } = useUser();
  const isVerified = Boolean(profile?.is_verified);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", values.name);
      if (values.description) formData.append("description", values.description);
      formData.append("membership_type", values.membership_type);
      if (values.price) formData.append("price", values.price);
      if (values.avatar_url) formData.append("avatar_url", values.avatar_url);
      if (values.cover_image_url) formData.append("cover_image_url", values.cover_image_url);

      const result = await createCommunity(formData);

      if (result.error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error,
        });
      } else {
        toast({
          title: "Success",
          description: "Community created successfully!",
        });
        form.reset();
        setOpen(false);
        router.push(`/communities/${result.data?.slug}`);
        router.refresh();
      }
    } catch (error) {
      const description = error instanceof Error ? error.message : "Failed to create community. Please try again.";
      toast({
        variant: "destructive",
        title: "Error",
        description,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Community
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Community</DialogTitle>
          <DialogDescription>
            Create a new community where users can share content and discussions.
          </DialogDescription>
        </DialogHeader>
        {!isVerified && (
          <div className="flex items-start gap-3 p-4 rounded-md bg-yellow-50 border border-yellow-100 mb-4">
            <ShieldAlert className="h-5 w-5 text-amber-600 mt-1" />
            <div>
              <div className="font-medium">Verified creators only</div>
              <div className="text-sm text-muted-foreground">Only verified creators and influencers may create communities. Apply for verification from the Settings page.</div>
            </div>
          </div>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Community Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Tech Enthusiasts" {...field} />
                  </FormControl>
                  <FormDescription>
                    Choose a unique name for your community (3-50 characters)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your community..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional description of your community (max 500 characters)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="membership_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Membership Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select membership type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Free communities are open to all. Paid communities require payment for access.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {membershipType === "paid" && (
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                      <FormLabel>Price (INR)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        placeholder="0"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Set the price for joining this community (in INR)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="avatar_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Avatar URL (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://example.com/avatar.jpg"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cover_image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cover Image URL (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://example.com/cover.jpg"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !isVerified}
                title={isVerified ? undefined : "Only verified creators can create communities"}
              >
                {loading ? "Creating..." : "Create Community"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

