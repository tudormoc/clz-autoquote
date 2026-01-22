export const APP_COPY = {
  header: {
    title: "CLZ Book Quote",
    subtitle: "Professional bookbinding estimation engine",
  },
  form: {
    bookNameLabel: "Book Project Name",
    bookNamePlaceholder: "e.g. My Awesome Novel",
    quantityLabel: "Quantity",
    dimensionsLabel: "Book Dimensions (mm)",
    width: "Width",
    height: "Height",
    pagesLabel: "Number of Pages",
    submitButton: "Generate Quote",
    resetButton: "Reset Form",
  },
  results: {
    title: "Quote Breakdown",
    basePrice: "Base Binding Fee",
    areaCost: "Paper & Size Cost",
    pageCost: "Print & Page Cost",
    subtotal: "Subtotal",
    discount: "Volume Discount",
    total: "Total Estimated Price",
    unitPrice: "Price Per Unit",
  },
  errors: {
    generic: "An unexpected error occurred. Please contact support.",
    validation: "Please check your inputs and try again.",
    saveFailed: "Failed to save quote to record.",
  },
  emptyState: "Enter the book details to generate a professional binding quote.",
  history: {
    title: "Recent Quotes",
    empty: "No quotes generated yet.",
  }
} as const;