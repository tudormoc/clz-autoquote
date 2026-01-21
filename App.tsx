import React, { useState, useEffect } from 'react';
import { Settings, Calculator, ChevronRight, DollarSign, Package, AlertCircle } from 'lucide-react';
import { z } from 'zod';

// Config & Types
import { APP_COPY } from './config/copy';
import { PRICING_CONSTANTS } from './config/constants';
import type { Material, Client } from './types/database';

// Logic
import { calculateQuote, QuoteResult, QuoteRequestSchema } from './lib/pricing-engine';
import { dataService } from './services/dataService';

// Components
import ErrorBoundary from './components/ErrorBoundary';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';
import { Select } from './components/ui/Select';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './components/ui/Card';

const AppContent: React.FC = () => {
  // --- State ---
  const [materials, setMaterials] = useState<Material[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    materialId: '',
    clientId: '',
    quantity: 1,
    width: 100,
    height: 100,
    depth: 100,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);

  // --- Effects ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [mats, clis] = await Promise.all([
          dataService.getMaterials(),
          dataService.getClients()
        ]);
        setMaterials(mats);
        setClients(clis);
        
        // Set defaults
        if (mats.length > 0) setFormData(prev => ({ ...prev, materialId: mats[0].id }));
        if (clis.length > 0) setFormData(prev => ({ ...prev, clientId: clis[0].id }));
        
      } catch (err) {
        setError(APP_COPY.errors.fetchFailed);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- Handlers ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value
    }));
    
    // Clear specific error when user types
    if (formErrors[name]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleCalculate = () => {
    setQuoteResult(null);
    setFormErrors({});

    // 1. Prepare Request Object
    const request = {
      materialId: formData.materialId,
      quantity: formData.quantity,
      dimensions: {
        width: formData.width,
        height: formData.height,
        depth: formData.depth
      },
      clientId: formData.clientId || undefined
    };

    // 2. Validate using Zod (Schema from Pricing Engine)
    const validation = QuoteRequestSchema.safeParse(request);

    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.issues.forEach(err => {
        const path = err.path.join('_'); // Flatten nested paths for simple mapping
        // Map nested path dimensions_width to width input name if needed, 
        // but for simplicity we kept flat names in form state. 
        // We'll map dimensions.width -> width
        let fieldName = err.path[0] as string;
        if (fieldName === 'dimensions') fieldName = err.path[1] as string;
        
        errors[fieldName] = err.message;
      });
      setFormErrors(errors);
      return;
    }

    // 3. Execute Engine
    const selectedMaterial = materials.find(m => m.id === formData.materialId);
    const selectedClient = clients.find(c => c.id === formData.clientId);

    if (!selectedMaterial) {
      setFormErrors({ materialId: "Invalid material selected" });
      return;
    }

    try {
      const result = calculateQuote(validation.data, selectedMaterial, selectedClient);
      setQuoteResult(result);
    } catch (e) {
      setError(APP_COPY.errors.generic);
    }
  };

  const handleReset = () => {
    setQuoteResult(null);
    setFormData({
      materialId: materials[0]?.id || '',
      clientId: clients[0]?.id || '',
      quantity: 1,
      width: 100,
      height: 100,
      depth: 100,
    });
    setFormErrors({});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-foreground pb-20">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900">{APP_COPY.header.title}</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">{APP_COPY.header.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-sm text-muted-foreground bg-gray-100 px-3 py-1 rounded-full">
               v1.0.0
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {error && (
            <div className="mb-6 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                <p>{error}</p>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Configuration Form */}
          <div className="lg:col-span-7 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-muted-foreground" />
                  Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Material Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Select
                        label={APP_COPY.form.materialLabel}
                        id="materialId"
                        name="materialId"
                        value={formData.materialId}
                        onChange={handleInputChange}
                        options={materials.map(m => ({ value: m.id, label: `${m.name} ($${m.base_cost}/m³)` }))}
                        error={formErrors.materialId}
                    />
                     <Select
                        label={APP_COPY.form.clientTierLabel}
                        id="clientId"
                        name="clientId"
                        value={formData.clientId}
                        onChange={handleInputChange}
                        options={clients.map(c => ({ value: c.id, label: `${c.name} (-${c.discount_percentage}%)` }))}
                        error={formErrors.clientId}
                    />
                </div>

                <div className="border-t pt-4"></div>

                {/* Dimensions */}
                <div>
                   <h4 className="text-sm font-medium mb-4">{APP_COPY.form.dimensionsLabel}</h4>
                   <div className="grid grid-cols-3 gap-4">
                        <Input
                            label={APP_COPY.form.width}
                            type="number"
                            name="width"
                            id="width"
                            value={formData.width}
                            onChange={handleInputChange}
                            error={formErrors.width}
                        />
                        <Input
                            label={APP_COPY.form.height}
                            type="number"
                            name="height"
                            id="height"
                            value={formData.height}
                            onChange={handleInputChange}
                            error={formErrors.height}
                        />
                        <Input
                            label={APP_COPY.form.depth}
                            type="number"
                            name="depth"
                            id="depth"
                            value={formData.depth}
                            onChange={handleInputChange}
                            error={formErrors.depth}
                        />
                   </div>
                </div>

                {/* Quantity */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <Input
                        label={APP_COPY.form.quantityLabel}
                        type="number"
                        name="quantity"
                        id="quantity"
                        value={formData.quantity}
                        onChange={handleInputChange}
                        error={formErrors.quantity}
                    />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between bg-gray-50/50 border-t py-4">
                <Button variant="ghost" onClick={handleReset}>{APP_COPY.form.resetButton}</Button>
                <Button onClick={handleCalculate} className="gap-2">
                    {APP_COPY.form.submitButton}
                    <ChevronRight className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>

            {/* Helper Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
                <div className="bg-white p-3 rounded border">
                    <span className="font-semibold block text-foreground mb-1">Volume Discounts</span>
                    Orders over {PRICING_CONSTANTS.VOLUME_DISCOUNT_THRESHOLDS.TIER_1.MIN_QTY} units get {PRICING_CONSTANTS.VOLUME_DISCOUNT_THRESHOLDS.TIER_1.DISCOUNT * 100}% off.
                </div>
                <div className="bg-white p-3 rounded border">
                     <span className="font-semibold block text-foreground mb-1">Lead Time</span>
                     Standard lead time is 5-7 business days for current volume.
                </div>
                <div className="bg-white p-3 rounded border">
                     <span className="font-semibold block text-foreground mb-1">Setup Fee</span>
                     Flat rate ${PRICING_CONSTANTS.SETUP_FEE} setup fee applies to all production runs.
                </div>
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-5">
             {quoteResult ? (
                 <Card className="sticky top-24 border-primary/20 shadow-lg overflow-hidden">
                    <div className="h-2 bg-primary w-full"></div>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calculator className="h-5 w-5 text-primary" />
                            {APP_COPY.results.title}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{APP_COPY.results.materialCost}</span>
                                <span className="font-medium">${quoteResult.materialCost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{APP_COPY.results.laborCost}</span>
                                <span className="font-medium">${quoteResult.laborCost.toLocaleString()}</span>
                            </div>
                            <div className="border-t border-dashed my-2"></div>
                            <div className="flex justify-between text-sm font-medium">
                                <span>{APP_COPY.results.subtotal}</span>
                                <span>${quoteResult.subtotal.toLocaleString()}</span>
                            </div>
                        </div>

                        {(quoteResult.volumeDiscountAmount > 0 || quoteResult.clientDiscountAmount > 0) && (
                            <div className="bg-green-50 p-3 rounded-md space-y-2 border border-green-100">
                                {quoteResult.volumeDiscountAmount > 0 && (
                                    <div className="flex justify-between text-sm text-green-700">
                                        <span>{APP_COPY.results.discount} ({(quoteResult.breakdown.volumeDiscountPercent * 100).toFixed(0)}%)</span>
                                        <span>-${quoteResult.volumeDiscountAmount.toLocaleString()}</span>
                                    </div>
                                )}
                                {quoteResult.clientDiscountAmount > 0 && (
                                    <div className="flex justify-between text-sm text-green-700">
                                        <span>{APP_COPY.results.clientDiscount} ({(quoteResult.breakdown.clientDiscountPercent * 100).toFixed(0)}%)</span>
                                        <span>-${quoteResult.clientDiscountAmount.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="bg-primary/5 p-4 rounded-lg space-y-1 text-center">
                            <p className="text-sm text-muted-foreground uppercase tracking-wide font-semibold">{APP_COPY.results.total}</p>
                            <div className="text-4xl font-bold text-primary tracking-tight">
                                ${quoteResult.totalPrice.toLocaleString()}
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">
                                {APP_COPY.results.unitPrice}: <span className="font-medium text-foreground">${quoteResult.pricePerUnit}</span> / ea
                            </p>
                        </div>

                    </CardContent>
                    <CardFooter className="bg-gray-50 p-4 border-t flex flex-col gap-2">
                         <Button className="w-full" size="lg">
                            <DollarSign className="h-4 w-4 mr-2" />
                            Proceed to Order
                         </Button>
                         <p className="text-[10px] text-center text-muted-foreground">
                            *Quote valid for 30 days. Final shipping calculated at checkout.
                         </p>
                    </CardFooter>
                 </Card>
             ) : (
                <Card className="sticky top-24 border-dashed bg-gray-50/50">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                        <div className="bg-gray-200 p-4 rounded-full mb-4">
                            <Calculator className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="max-w-[200px]">{APP_COPY.emptyState}</p>
                    </CardContent>
                </Card>
             )}
          </div>

        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;