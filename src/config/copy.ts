export const APP_COPY = {
  header: {
    title: "AutoQuote Engine",
    subtitle: "Enterprise-grade automated pricing system",
  },
  form: {
    materialLabel: "Select Material",
    materialPlaceholder: "Choose a material...",
    quantityLabel: "Quantity",
    dimensionsLabel: "Dimensions (mm)",
    width: "Width",
    height: "Height",
    depth: "Depth",
    submitButton: "Calculate Quote",
    resetButton: "Reset Form",
    clientTierLabel: "Client Tier",
  },
  results: {
    title: "Quote Breakdown",
    materialCost: "Material Cost",
    laborCost: "Labor & Setup",
    subtotal: "Subtotal",
    discount: "Volume Discount",
    clientDiscount: "Client Tier Discount",
    total: "Total Estimated Price",
    unitPrice: "Price Per Unit",
  },
  errors: {
    generic: "An unexpected error occurred. Please contact support.",
    validation: "Please check your inputs and try again.",
    fetchFailed: "Failed to load pricing data.",
  },
  emptyState: "Configure the parameters on the left to generate a detailed quote.",
} as const;