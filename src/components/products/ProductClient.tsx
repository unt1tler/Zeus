
"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createProduct, deleteProduct } from "@/lib/actions";
import type { Product } from "@/lib/types";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { Upload, MoreHorizontal, Pencil, Trash2, PlusCircle, RefreshCw, ChevronsUpDown, Copy } from "lucide-react";
import { EditProductForm } from "./EditProductForm";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { cn } from "@/lib/utils";
import { CopyButton } from "../CopyButton";

const productSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters."),
  price: z.coerce.number().min(0, "Price must be a positive number."),
  imageData: z.string().optional(),
  hwidProtection: z.boolean().default(false),
  builtByBitResourceId: z.string().optional(),
});

type SortOption = "createdAt" | "price";
type FilterOption = "name" | "id" | "builtByBitResourceId";

export function ProductClient({ products }: { products: Product[] }) {
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isEditOpen, setEditOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterBy, setFilterBy] = useState<FilterOption>("name");
  const [sortBy, setSortBy] = useState<SortOption>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");


  const form = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      price: 0,
      imageData: "",
      hwidProtection: false,
      builtByBitResourceId: "",
    },
  });

  const filteredAndSortedProducts = useMemo(() => {
    let results = [...products];

    if (searchTerm) {
        const lowercasedSearchTerm = searchTerm.toLowerCase();
        results = results.filter(product => {
            const value = product[filterBy]?.toString().toLowerCase() || "";
            return value.includes(lowercasedSearchTerm);
        });
    }

    return results.sort((a, b) => {
        let valA, valB;
        switch (sortBy) {
            case 'price':
                valA = a.price;
                valB = b.price;
                break;
            case 'createdAt':
            default:
                valA = new Date(a.createdAt).getTime();
                valB = new Date(b.createdAt).getTime();
                break;
        }

        return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }, [products, searchTerm, filterBy, sortBy, sortDirection]);
  
  const getPlaceholder = () => {
    switch (filterBy) {
      case 'name': return 'Search by product name...';
      case 'id': return 'Search by product ID...';
      case 'builtByBitResourceId': return 'Search by BuiltByBit Resource ID...';
      default: return 'Search...';
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    const result = await deleteProduct(productId);
    if (result.success) {
      toast({
        title: "Product Deleted",
        description: "The product and all associated licenses have been deleted.",
      });
    } else {
       toast({
        title: "Error",
        description: result.message || "Failed to delete product.",
        variant: "destructive",
      });
    }
  };

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
    const result = await createProduct(values);

    if (result?.errors) {
      // Handle server-side validation errors
    } else {
      toast({
        title: "Success",
        description: "Product created successfully.",
      });
      form.reset();
      setImagePreview(null);
      setCreateOpen(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <Card>
            <CardContent className="p-4">
                <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-6">
                    <div className="md:col-span-2">
                        <Label htmlFor="sort-by">Sort by</Label>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="shrink-0" onClick={() => {
                                setSearchTerm("");
                                setSortBy("createdAt");
                                setFilterBy("name");
                                setSortDirection("desc");
                            }}>
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                                <SelectTrigger id="sort-by">
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="createdAt">Creation Date</SelectItem>
                                    <SelectItem value="price">Price</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="outline" size="icon" className="shrink-0" onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}>
                                <ChevronsUpDown className={cn("h-4 w-4 transform transition-transform", sortDirection === 'asc' && "rotate-180")}/>
                            </Button>
                        </div>
                    </div>
                    
                    <div className="md:col-span-3">
                        <Label htmlFor="filter-by">Filter & Search</Label>
                        <div className="flex items-center gap-2">
                            <Select value={filterBy} onValueChange={(v) => setFilterBy(v as FilterOption)}>
                                <SelectTrigger id="filter-by" className="w-[180px]">
                                    <SelectValue placeholder="Filter by" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="name">Name</SelectItem>
                                    <SelectItem value="id">ID</SelectItem>
                                    <SelectItem value="builtByBitResourceId">BBB Resource ID</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input
                                id="search"
                                placeholder={getPlaceholder()}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="flex-1"
                            />
                        </div>
                    </div>

                    <div className="flex w-full items-end gap-2 md:col-span-1">
                        <Dialog open={isCreateOpen} onOpenChange={(open) => {
                            setCreateOpen(open);
                            if (!open) {
                                form.reset();
                                setImagePreview(null);
                            }
                            }}>
                            <DialogTrigger asChild>
                                <Button className="w-full">
                                    <PlusCircle className="mr-2" />
                                    Create
                                </Button>
                            </DialogTrigger>
                             <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                <DialogTitle>Create a new Product</DialogTitle>
                                <DialogDescription>
                                    Add details for your new product. Click save when you're done.
                                </DialogDescription>
                                </DialogHeader>
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
                                                        htmlFor="file-upload"
                                                        className="relative cursor-pointer rounded-md font-semibold text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 hover:text-primary/80"
                                                    >
                                                        <span>Upload a file</span>
                                                        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleImageChange} accept="image/*"/>
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
                                        {form.formState.isSubmitting ? "Saving..." : "Save Product"}
                                    </Button>
                                    </DialogFooter>
                                </form>
                                </Form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </CardContent>
        </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredAndSortedProducts.length > 0 ? (
          filteredAndSortedProducts.map((product) => (
            <Card key={product.id} className="overflow-hidden group">
                <div className="relative aspect-[4/3] w-full bg-muted">
                    <Image
                        src={product.imageUrl}
                        alt={product.name}
                        width={400}
                        height={300}
                        className="h-full w-full object-cover"
                        data-ai-hint="software product"
                    />
                     <div className="absolute top-2 right-2">
                        <AlertDialog>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="secondary" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={() => {
                                        setSelectedProduct(product);
                                        setEditOpen(true);
                                    }}>
                                        <Pencil className="mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem className="text-destructive">
                                             <Trash2 className="mr-2" /> Delete
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                </DropdownMenuContent>
                            </DropdownMenu>
                             <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will permanently delete the product "{product.name}" and all of its associated licenses. This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteProduct(product.id)} className="bg-destructive hover:bg-destructive/90">
                                        Confirm Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
              <CardContent className="p-4">
                <h3 className="text-lg font-semibold">{product.name}</h3>
                <div className="flex items-center gap-1">
                    <p className="text-xs text-muted-foreground font-mono truncate">{product.id}</p>
                    <CopyButton textToCopy={product.id} className="h-6 w-6" />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-lg font-bold">${product.price.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
            <div className="col-span-full text-center py-10">
                <p className="text-muted-foreground">No products found matching your criteria.</p>
            </div>
        )}
      </div>
      </div>

       <Dialog open={isEditOpen} onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) {
                setSelectedProduct(null);
            }
        }}>
            {selectedProduct && (
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Product: {selectedProduct.name}</DialogTitle>
                        <DialogDescription>
                            Update the details for your product. Click save when you're done.
                        </DialogDescription>
                    </DialogHeader>
                    <EditProductForm product={selectedProduct} onSuccess={() => {
                      setEditOpen(false);
                      setSelectedProduct(null);
                    }} />
                </DialogContent>
            )}
        </Dialog>
    </>
  );
}
