import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, Zap, Award } from "lucide-react";

interface GoalProgressProps {
  current: number;
  target: number;
  title: string;
  icon: 'target' | 'zap' | 'efficiency';
  description?: string;
  unit?: string;
}

const GoalProgress = ({ current, target, title, icon, description, unit = '' }: GoalProgressProps) => {
  const percentage = Math.min(Math.round((current / target) * 100), 100);
  
  const getIcon = () => {
    switch (icon) {
      case 'target': return <Target className="h-4 w-4 text-blue-500" />;
      case 'zap': return <Zap className="h-4 w-4 text-amber-500" />;
      default: return <Award className="h-4 w-4 text-emerald-500" />;
    }
  };

  const getColor = (p: number) => {
    if (p < 30) return 'bg-rose-500';
    if (p < 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <Card className="border-none shadow-md bg-card/60 backdrop-blur-md overflow-hidden transition-all hover:shadow-lg group">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          {getIcon()}
          {title}
        </CardTitle>
        <span className="text-xs font-black text-foreground bg-muted px-2 py-0.5 rounded-full">
          META: {target}{unit}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <span className="text-4xl font-black tracking-tighter">
              {current}{unit}
            </span>
            {description && (
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                {description}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className={`text-lg font-black ${percentage >= 100 ? 'text-emerald-500' : 'text-primary'}`}>
              {percentage}%
            </div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold uppercase">
              <TrendingUp className="h-3 w-3" />
              +12% vs mês ant.
            </div>
          </div>
        </div>
        
        <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
          <div 
            className={`absolute top-0 left-0 h-full ${getColor(percentage)} transition-all duration-1000 ease-out rounded-full shadow-[0_0_10px_rgba(0,0,0,0.2)]`} 
            style={{ width: `${percentage}%` }}
          />
          {/* Animated shine effect */}
          <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg] animate-[shimmer_2s_infinite] pointer-events-none" />
        </div>
        
        <style>
          {`
            @keyframes shimmer {
              0% { transform: translateX(-100%) skewX(-20deg); }
              100% { transform: translateX(200%) skewX(-20deg); }
            }
          `}
        </style>
        
        <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase">
          <span>0</span>
          <span>50%</span>
          <span>{target}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default GoalProgress;
