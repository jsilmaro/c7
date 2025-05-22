import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { XIcon } from "lucide-react";
import { Plus, AlertTriangle } from "lucide-react";
import { budgetApi, transactionsApi } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BudgetCategoryForm from "@/components/budgeting/BudgetCategoryForm";

interface Budget {
  id: string;
  category: string;
  amount: number;
  spent: number;
  period: string;
  start_date: string;
  end_date: string;
}

const Budgeting = () => {
  const [showForm, setShowForm] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("monthly");

  const { data: budgets, isLoading, error, refetch } = useQuery({
    queryKey: ["budgets", selectedPeriod],
    queryFn: async () => {
      try {
        const [budgetsResponse, transactionsResponse] = await Promise.all([
          budgetApi.getAll(),
          transactionsApi.getAll()
        ]);

        const transactions = transactionsResponse.data;
        const filteredBudgets = budgetsResponse.data
          .filter((budget: Budget) => budget.period === selectedPeriod);

        // Calculate spent amount for each budget from transactions
        return filteredBudgets.map((budget: Budget) => {
          const categoryTransactions = transactions.filter(
            (t: any) => t.category.toLowerCase() === budget.category.toLowerCase() 
              && t.type === 'expense'
              && new Date(t.date) >= new Date(budget.start_date)
              && new Date(t.date) <= new Date(budget.end_date)
          );

          const spent = categoryTransactions.reduce(
            (sum: number, t: any) => sum + parseFloat(t.amount), 
            0
          );

          return { ...budget, spent };
        });
      } catch (error) {
        console.error('Error fetching budgets:', error);
        throw error;
      }
    },
  });

  useEffect(() => {
    if (error) {
      toast.error("Failed to load budgets", {
        description: "Please try again later"
      });
    }
  }, [error]);

  const handleBudgetSaved = () => {
    setShowForm(false);
    refetch();
    toast.success("Budget saved successfully");
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "bg-red-500";
    if (percentage >= 90) return "bg-red-400";
    if (percentage >= 80) return "bg-red-300";
    if (percentage >= 70) return "bg-yellow-500";
    if (percentage >= 60) return "bg-yellow-400";
    return "bg-green-500";
  };

  const getBackgroundColor = (percentage: number) => {
    if (percentage >= 100) return "bg-red-100 dark:bg-red-950";
    if (percentage >= 90) return "bg-red-50 dark:bg-red-900";
    if (percentage >= 80) return "bg-yellow-50 dark:bg-yellow-900";
    return "bg-green-50 dark:bg-green-900";
  };

  const renderProgressBar = (budget: Budget) => {
    const percentage = Math.min(Math.round((budget.spent / budget.amount) * 100), 100);
    const progressColor = getProgressColor(percentage);
    const backgroundColor = getBackgroundColor(percentage);
    const isOverBudget = budget.spent > budget.amount;

    return (
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className={isOverBudget ? "text-red-600 font-medium" : ""}>
            ${Number(budget.spent).toFixed(2)} spent
          </span>
          <span>${Number(budget.amount).toFixed(2)} budgeted</span>
        </div>
        <div className="relative">
          <Progress 
            value={percentage} 
            className={`h-2 ${backgroundColor} [&>[data-progress]]:${progressColor}`}
          />
          {isOverBudget && (
            <div className="absolute top-0 right-0 -mt-1 text-red-600 flex items-center gap-1 text-xs">
              <AlertTriangle size={14} />
              <span>Over budget</span>
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {percentage}% of budget used
        </div>
      </div>
    );
  };

  const getCategoryDisplayName = (category: string) => {
    return category.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Budgeting</h1>
          <p className="text-muted-foreground">
            Manage your monthly budgets and track your spending.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Budget
        </Button>
      </div>

      <Tabs defaultValue="monthly" onValueChange={setSelectedPeriod}>
        <TabsList>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
          <TabsTrigger value="annual">Annual</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <Card key={n} className="animate-pulse">
              <CardHeader className="h-20 bg-muted/50" />
              <CardContent className="h-24 bg-muted/30" />
            </Card>
          ))}
        </div>
      ) : budgets && budgets.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget: Budget) => (
            <Card key={budget.id} className="group relative">
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 absolute right-4 top-4"
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Budget</DialogTitle>
                  </DialogHeader>
                  <p>Are you sure you want to delete this budget category?</p>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                    <Button 
                      variant="destructive" 
                      onClick={async () => {
                        try {
                          await budgetApi.delete(budget.id);
                          refetch();
                          toast.success("Budget deleted successfully", {
                            duration: 3000
                          });
                        } catch (error) {
                          toast.error("Failed to delete budget", {
                            duration: 3000
                          });
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <CardHeader>
                <CardTitle>{getCategoryDisplayName(budget.category)}</CardTitle>
                <CardDescription>
                  {budget.period.charAt(0).toUpperCase() + budget.period.slice(1)} Budget
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderProgressBar(budget)}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Budgets Set</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You haven't set any budgets yet. Click the "New Budget" button to get started.
            </p>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <BudgetCategoryForm 
          onClose={() => setShowForm(false)}
          onSave={handleBudgetSaved}
          period={selectedPeriod}
        />
      )}
    </div>
  );
};

export default Budgeting;