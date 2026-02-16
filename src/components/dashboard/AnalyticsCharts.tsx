import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
    BarChart, Bar
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Custom Colors
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const THEME_COLORS = {
    primary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
    textSecondary: '#64748b'
};

interface ChartProps {
    data: any[];
    title: string;
}

export const TrendChart = ({ data, title }: ChartProps) => (
    <Card className="col-span-1 md:col-span-2 shadow-md hover:shadow-xl transition-all duration-300 border-none bg-card/50 backdrop-blur-sm">
        <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center justify-between">
                {title}
            </CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={THEME_COLORS.primary} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={THEME_COLORS.primary} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: THEME_COLORS.textSecondary, fontSize: 12 }}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: THEME_COLORS.textSecondary, fontSize: 12 }}
                    />
                    <Tooltip
                        contentStyle={{
                            borderRadius: '12px',
                            border: 'none',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            backgroundColor: 'white'
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={THEME_COLORS.primary}
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorValue)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </CardContent>
    </Card>
);

export const StatusDistributionChart = ({ data, title }: ChartProps) => (
    <Card className="shadow-md hover:shadow-xl transition-all duration-300 border-none bg-card/50 backdrop-blur-sm">
        <CardHeader>
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            borderRadius: '12px',
                            border: 'none',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                    />
                    <Legend iconType="circle" />
                </PieChart>
            </ResponsiveContainer>
        </CardContent>
    </Card>
);

export const TopClientsChart = ({ data, title }: ChartProps) => (
    <Card className="shadow-md hover:shadow-xl transition-all duration-300 border-none bg-card/50 backdrop-blur-sm">
        <CardHeader>
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" hide />
                    <YAxis
                        type="category"
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: THEME_COLORS.textSecondary, fontSize: 11 }}
                        width={80}
                    />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} />
                    <Bar
                        dataKey="value"
                        fill={THEME_COLORS.primary}
                        radius={[0, 4, 4, 0]}
                        barSize={12}
                    />
                </BarChart>
            </ResponsiveContainer>
        </CardContent>
    </Card>
);
