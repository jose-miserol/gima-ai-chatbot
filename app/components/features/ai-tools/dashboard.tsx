/**
 * @file dashboard.tsx
 * @module app/components/features/ai-tools
 *
 * ============================================================
 * CLIENTE DEL DASHBOARD DE HERRAMIENTAS DE IA
 * ============================================================
 *
 * QUÉ HACE:
 * Renderiza la pantalla principal panorámica del panel `/tools`.
 * Despliega un repositorio (grid) de acceso al ecosistema funcional de la IA.
 *
 * CONTEXTO EN GIMA:
 * Emula la vista modular `StatCard` usada por GIMA Projects original.
 * Asegura la inmersión del usuario preservando las sombras suaves,
 * el layout en cuadrícula y la paleta de colores corporativos en blanco tiza.
 *
 * CÓMO FUNCIONA:
 * - Consume una variable estática local `aiTools` con la biblioteca de acciones.
 * - Consume el componente común `DashboardHeader`.
 * - Pinta tarjetas estilizadas que muestran viñetas y descripciones precisas,
 *   junto a llamadas de acción dinámicas de redireccionamiento.
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

import { DashboardHeader } from '@/app/components/layout/dashboard-header';

/**
 *
 */
export function AIToolsDashboardClient() {
  const greeting = useMemo(() => getGreeting(), []);

  return (
    <div className="min-h-screen bg-gray-50/50 -m-4 md:-m-8">
      <DashboardHeader title="Herramientas de IA" subtitle={`${greeting} Selecciona una herramienta para comenzar.`} />

      <div className="p-8 space-y-8">
        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {aiTools.map((tool) => (
            <Card key={tool.id} className="flex flex-col bg-white border border-gray-200 text-gray-900 hover:shadow-md transition-all duration-200 rounded-2xl group overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform duration-300">
                    {tool.icon}
                  </div>
                  {tool.badge && (
                    <Badge
                      variant={tool.badge === 'Herramienta' ? 'default' : 'secondary'}
                      className="text-xs font-medium"
                    >
                      {tool.badge}
                    </Badge>
                  )}
                </div>
                <CardTitle className="mt-5 text-xl">{tool.title}</CardTitle>
                <CardDescription className="text-sm text-gray-500 line-clamp-2">{tool.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 pb-6">
                <ul className="space-y-2.5">
                  {tool.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-0 border-t border-gray-100 bg-gray-50/50">
                {tool.href === '#modal' ? (
                  <Button variant="ghost" className="w-full mt-4 justify-between text-gray-500 hover:text-gray-700" disabled>
                    <span className="flex items-center gap-2">
                      Disponible en OT
                    </span>
                  </Button>
                ) : (
                  <Button asChild variant="ghost" className="w-full mt-4 justify-between hover:bg-blue-50 hover:text-blue-700">
                    <Link href={tool.href} className="flex items-center">
                      Abrir herramienta
                      <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
