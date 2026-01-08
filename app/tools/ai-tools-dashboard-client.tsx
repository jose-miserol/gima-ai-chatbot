/**
 * AI Tools Dashboard Client
 *
 * Muestra cards de todas las herramientas AI disponibles con stats y tips.
 */

'use client';

import {
  CheckCircle2,
  FileText,
  Sparkles,
  ArrowRight,
  Zap,
  Clock,
  TrendingUp,
  Lightbulb,
  ImageIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';


interface AITool {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  badge?: string;
  features: string[];
}

const aiTools: AITool[] = [
  {
    id: 'checklist-builder',
    title: 'Checklist Builder',
    description: 'Genera checklists de mantenimiento personalizados con IA',
    icon: <CheckCircle2 className="h-8 w-8 text-primary" />,
    href: '/tools/checklist-builder',
    badge: 'Popular',
    features: [
      'Checklists personalizados por activo',
      'Múltiples tipos de mantenimiento',
      'Generación en segundos',
      'Historial de checklists',
    ],
  },
  {
    id: 'activity-summaries',
    title: 'Activity Summaries',
    description: 'Resúmenes profesionales de actividades de mantenimiento',
    icon: <FileText className="h-8 w-8 text-primary" />,
    href: '/tools/activity-summaries',
    badge: 'Nuevo',
    features: [
      '3 estilos profesionales',
      '3 niveles de detalle',
      'Resumen ejecutivo incluido',
      'Métricas de lectura',
    ],
  },
  {
    id: 'data-transformation',
    title: 'Data Transformation',
    description: 'Limpia, formatea y transforma datos con instrucciones en lenguaje natural',
    icon: <Zap className="h-8 w-8 text-primary" />,
    href: '/tools/data-transformation',
    badge: 'Nuevo',
    features: [
      'Transformación con IA (Gemini)',
      'Vista previa antes de aplicar',
      'Historial con rollback',
      'Múltiples formatos (JSON, CSV)',
    ],
  },
  {
    id: 'work-order-closeout',
    title: 'Work Order Closeout',
    description: 'Notas de cierre profesionales para órdenes de trabajo',
    icon: <Sparkles className="h-8 w-8 text-primary" />,
    href: '#modal',
    badge: 'Modal',
    features: [
      'Notas de cierre detalladas',
      'Análisis de hallazgos',
      'Recomendaciones automáticas',
      'Integrado en WO detail',
    ],
  },
  {
    id: 'image-upload-test',
    title: 'Image Upload Test',
    description: 'Test image analysis with Gemini Vision',
    icon: <ImageIcon className="h-8 w-8 text-primary" />,
    href: '/tools/image-upload-test',
    badge: 'Testing',
    features: [
      'Upload & analyze images',
      'Gemini Vision integration',
      'File validation (10MB max)',
      'Drag & drop support',
    ],
  },
  {
    id: 'pdf-upload-test',
    title: 'PDF Upload Test',
    description: 'Test PDF content extraction and analysis',
    icon: <FileText className="h-8 w-8 text-primary" />,
    href: '/tools/pdf-upload-test',
    badge: 'Testing',
    features: [
      'Upload & analyze PDFs',
      'Custom prompt support',
      'File validation (20MB max)',
      'Content extraction',
    ],
  },
];

const proTips = [
  {
    title: 'Usa atajos de teclado',
    description: 'Presiona Ctrl+Enter para generar contenido rápidamente en cualquier formulario.',
    icon: <Zap className="h-5 w-5" />,
  },
  {
    title: 'Activa el guardado automático',
    description: 'Tus borradores se guardan cada 30 segundos para que nunca pierdas tu trabajo.',
    icon: <Clock className="h-5 w-5" />,
  },
  {
    title: 'Exporta en múltiples formatos',
    description: 'Cada resultado puede exportarse como JSON o Markdown con un solo clic.',
    icon: <FileText className="h-5 w-5" />,
  },
  {
    title: 'Revisa el historial',
    description: 'Todas tus generaciones se guardan en el historial para acceso rápido.',
    icon: <TrendingUp className="h-5 w-5" />,
  },
];

/**
 * Obtiene saludo personalizado según hora del día
 */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return '¡Buenos días!';
  if (hour < 18) return '¡Buenas tardes!';
  return '¡Buenas noches!';
}

/**
 *
 */
export function AIToolsDashboardClient() {
  // Greeting personalizado según hora
  const greeting = useMemo(() => getGreeting(), []);

  // Tip aleatorio del día (basado en día del mes)
  const tipOfTheDay = useMemo(() => {
    const dayIndex = new Date().getDate() % proTips.length;
    return proTips[dayIndex];
  }, []);

  // Quick stats (simulados - en producción vendrían de API)
  const quickStats = useMemo(() => ({
    usedToday: 3,
    quota: 100,
    timeSaved: '45 min',
    successRate: 98,
  }), []);

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Hero Section con Greeting */}
      <div className="text-center space-y-4 py-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">Powered by AI</span>
        </div>

        <h1 className="text-4xl font-bold tracking-tight">{greeting} Herramientas de IA</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Potencia tu gestión de mantenimiento con inteligencia artificial de última generación
        </p>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{quickStats.usedToday}</p>
              <p className="text-xs text-muted-foreground">Generaciones hoy</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Clock className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{quickStats.timeSaved}</p>
              <p className="text-xs text-muted-foreground">Tiempo ahorrado</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{quickStats.successRate}%</p>
              <p className="text-xs text-muted-foreground">Tasa de éxito</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tip del Día */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-4 p-4">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              💡 Tip del día: {tipOfTheDay.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{tipOfTheDay.description}</p>
          </div>
        </CardContent>
      </Card>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {aiTools.map((tool) => (
          <Card key={tool.id} className="flex flex-col hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="p-3 bg-primary/10 rounded-lg">{tool.icon}</div>
                {tool.badge && (
                  <Badge
                    variant={tool.badge === 'Popular' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {tool.badge}
                  </Badge>
                )}
              </div>
              <CardTitle className="mt-4">{tool.title}</CardTitle>
              <CardDescription>{tool.description}</CardDescription>
            </CardHeader>

            <CardContent className="flex-1">
              <ul className="space-y-2">
                {tool.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              {tool.href === '#modal' ? (
                <Button variant="outline" className="w-full" disabled>
                  <span className="flex items-center gap-2">
                    Disponible en WO Detail
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Button>
              ) : (
                <Button asChild className="w-full">
                  <Link href={tool.href} className="flex items-center gap-2">
                    Abrir herramienta
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Info Section */}
      <div className="mt-12 text-center space-y-4 p-8 bg-muted/50 rounded-lg border">
        <h2 className="text-2xl font-semibold">¿Cómo funcionan estas herramientas?</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Todas nuestras herramientas utilizan <strong>llama-3.3-70b-versatile</strong> a través de
          GROQ, uno de los modelos de lenguaje más avanzados disponibles. La IA analiza tus datos de
          mantenimiento y genera contenido profesional en segundos, ahorrándote tiempo y mejorando
          la consistencia de tu documentación.
        </p>

        <div className="flex flex-wrap gap-4 justify-center mt-6">
          <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-lg border">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Generación instantánea</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-lg border">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Resultados consistentes</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-lg border">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Caché inteligente</span>
          </div>
        </div>
      </div>
    </div>
  );
}
