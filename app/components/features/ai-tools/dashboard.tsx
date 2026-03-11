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
    title: 'Generador de Checklists',
    description: 'Genera checklists de mantenimiento personalizados con IA',
    icon: <CheckCircle2 className="h-8 w-8 text-gima-blue" />,
    href: '/tools/checklist-builder',
    badge: 'Herramienta',
    features: [
      'Checklists personalizados por activo',
      'Múltiples tipos de mantenimiento',
      'Generación en segundos',
      'Historial de checklists',
    ],
  },
  {
    id: 'activity-summaries',
    title: 'Resúmenes de Actividad',
    description: 'Resúmenes profesionales de actividades de mantenimiento',
    icon: <FileText className="h-8 w-8 text-gima-blue" />,
    href: '/tools/activity-summaries',
    badge: 'Herramienta',
    features: [
      '3 estilos profesionales',
      '3 niveles de detalle',
      'Resumen ejecutivo incluido',
      'Métricas de lectura',
    ],
  },
  {
    id: 'data-transformation',
    title: 'Transformación de Datos',
    description: 'Limpia, formatea y transforma datos con instrucciones en lenguaje natural',
    icon: <Zap className="h-8 w-8 text-gima-blue" />,
    href: '/tools/data-transformation',
    badge: 'Herramienta',
    features: [
      'Transformación con IA (Gemini)',
      'Vista previa antes de aplicar',
      'Historial con rollback',
      'Múltiples formatos (JSON, CSV)',
    ],
  },
  {
    id: 'work-order-closeout',
    title: 'Cierre de Orden de Trabajo',
    description: 'Notas de cierre profesionales para órdenes de trabajo',
    icon: <Sparkles className="h-8 w-8 text-gima-blue" />,
    href: '#modal',
    badge: 'Herramienta',
    features: [
      'Notas de cierre detalladas',
      'Análisis de hallazgos',
      'Recomendaciones automáticas',
      'Integrado en detalle de OT',
    ],
  },
  {
    id: 'image-upload-test',
    title: 'Análisis de Imágenes',
    description: 'Analiza imágenes de equipos y activos con Gemini Vision',
    icon: <ImageIcon className="h-8 w-8 text-gima-blue" />,
    href: '/tools/image-upload-test',
    badge: 'Herramienta',
    features: [
      'Sube y analiza imágenes',
      'Integración con Gemini Vision',
      'Validación de archivo (máx. 10MB)',
      'Arrastrar y soltar',
    ],
  },
  {
    id: 'pdf-upload-test',
    title: 'Análisis de PDF',
    description: 'Extrae y analiza contenido de documentos PDF',
    icon: <FileText className="h-8 w-8 text-gima-blue" />,
    href: '/tools/pdf-upload-test',
    badge: 'Herramienta',
    features: [
      'Sube y analiza PDFs',
      'Instrucciones personalizadas',
      'Validación de archivo (máx. 20MB)',
      'Extracción de contenido',
    ],
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

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Hero Section con Greeting */}
      <div className="text-center space-y-4 py-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gima-blue/10 rounded-full border border-gima-blue/20">
          <Zap className="h-4 w-4 text-gima-blue" />
          <span className="text-sm font-medium text-gima-blue">Impulsado por IA</span>
        </div>

        <h1 className="text-4xl font-bold tracking-tight">{greeting} Herramientas de IA</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Potencia tu gestión de mantenimiento con inteligencia artificial de última generación
        </p>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {aiTools.map((tool) => (
          <Card key={tool.id} className="flex flex-col hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="p-3 bg-gima-blue/10 rounded-lg">{tool.icon}</div>
                {tool.badge && (
                  <Badge
                    variant={tool.badge === 'Herramienta' ? 'default' : 'secondary'}
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
                    <CheckCircle2 className="h-4 w-4 text-gima-blue flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              {tool.href === '#modal' ? (
                <Button variant="outline" className="w-full" disabled>
                  <span className="flex items-center gap-2">
                    Disponible en Detalle de OT
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
            <Sparkles className="h-4 w-4 text-gima-blue" />
            <span className="text-sm font-medium">Generación instantánea</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-lg border">
            <CheckCircle2 className="h-4 w-4 text-gima-blue" />
            <span className="text-sm font-medium">Resultados consistentes</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-lg border">
            <Zap className="h-4 w-4 text-gima-blue" />
            <span className="text-sm font-medium">Caché inteligente</span>
          </div>
        </div>
      </div>
    </div>
  );
}
