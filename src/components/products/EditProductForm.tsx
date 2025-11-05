

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateProduct } from "@/lib/actions";
import type { Product } from "@/lib/types";

import { Button } from "@/components/ui/button";
import {
  DialogFooter,
  DialogClose,
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
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { Upload } from "lucide-react";
import { Checkbox } from "../ui/checkbox";

const productSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters."),
  price: z.coerce.number().min(0, "Price must be a positive number."),
  imageData: z.string().optional(),
  hwidProtection: z.boolean().default(false),
  builtByBitResourceId: z.string().optional(),
});

interface EditProductFormProps {
  product: Product;
  onSuccess: () => void;
}

export function EditProductForm({ product, onSuccess }: EditProductFormProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(product.imageUrl);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product.name,
      price: product.price,
      imageData: "",
      hwidProtection: product.hwidProtection || false,
      builtByBitResourceId: product.builtByBitResourceId || "",
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        form.setValue("imageData", result);
        setImagePreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  async function onSubmit(values: z.infer<typeof productSchema>) {
    const result = await updateProduct(product.id, values);

    if (result?.errors) {
    } else {
      toast({
        title: "Success",
        description: "Product updated successfully.",
      });
      form.reset();
      setImagePreview(null);
      onSuccess();
    }
  }

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Product Name</FormLabel>
                <FormControl>
                <Input placeholder="e.g. My Awesome App" {...field} />
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
        <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Price ($)</FormLabel>
                <FormControl>
                <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
        <FormField
            control={form.control}
            name="builtByBitResourceId"
            render={({ field }) => (
            <FormItem>
                <FormLabel>BuiltByBit Resource ID (Optional)</FormLabel>
                <FormControl>
                <Input placeholder="e.g., 12345" {...field} />
                </FormControl>
                <FormDescription>
                Used for the /link-builtbybit command.
                </FormDescription>
                <FormMessage />
            </FormItem>
            )}
        />
        <FormField
            control={form.control}
            name="hwidProtection"
            render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                    <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    />
                </FormControl>
                <div className="space-y-1 leading-none">
                    <FormLabel>
                    HWID Protection
                    </FormLabel>
                    <FormDescription>
                    If enabled, all licenses for this product will require a matching Hardware ID for validation.
                    </FormDescription>
                </div>
                </FormItem>
            )}
        />
        <FormItem>
            <FormLabel>Product Image</FormLabel>
            <FormControl>
            <div className="mt-2 flex justify-center rounded-lg border border-dashed border-input px-6 py-10">
                <div className="text-center">
                    {imagePreview ? (
                        <Image src={imagePreview} alt="Image preview" width={150} height={150} className="mx-auto mb-4 rounded-md"/>
                    ) : (
                        <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                    )}
                    <div className="mt-4 flex text-sm leading-6 text-muted-foreground">
                        <label
                            htmlFor="file-upload-edit"
                            className="relative cursor-pointer rounded-md font-semibold text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 hover:text-primary/80"
                        >
                            <span>Upload a file</span>
                            <input id="file-upload-edit" name="file-upload" type="file" className="sr-only" onChange={handleImageChange} accept="image/*"/>
                        </label>
                        <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
                </div>
            </div>
            </FormControl>
            <FormMessage />
        </FormItem>

        <DialogFooter>
            <DialogClose asChild>
            <Button type="button" variant="secondary">
                Cancel
            </Button>
            </DialogClose>
            <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
        </DialogFooter>
        </form>
    </Form>
  );
}
