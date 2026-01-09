'use client';

import { useState } from 'react';
import {
    MessageCircle,
    Mic,
    Image as ImageIcon,
    History,
    Keyboard,
    Radio,
    HelpCircle,
    Command,
    Copy,
    Check
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { Button } from '@/app/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from '@/app/components/ui/dialog';
import { ScrollArea } from '@/app/components/ui/scroll-area';

export function ChatHelp() {
    const [activeTab, setActiveTab] = useState<'features' | 'commands'>('features');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const features = [
        {
            icon: MessageCircle,
            title: 'Mensajería de Texto',
            description: 'Conversa fluidamente con la IA usando el modelo GROQ para respuestas rápidas.'
        },
        {
            icon: Mic,
            title: 'Entrada de Voz',
            description: 'Usa el micrófono para dictar mensajes. Compatible con Gemini y reconocimiento nativo.'
        },
        {
            icon: ImageIcon,
            title: 'Análisis de Imágenes',
            description: 'Sube imágenes para que la IA las analice y describa automáticamente.'
        },
        {
            icon: History,
            title: 'Historial Persistente',
            description: 'Tus conversaciones se guardan localmente para que puedas retomarlas después.'
        },
        {
            icon: Keyboard,
            title: 'Atajos de Teclado',
            description: 'Presiona Ctrl+Enter para enviar mensajes rápidamente.'
        },
        {
            icon: Radio,
            title: 'Comandos de Voz',
            description: 'Di "Crear orden de trabajo para..." para generar órdenes automáticamente.'
        }
    ];

    const commands = [
        {
            id: 'cmd-create',
            action: 'Crear Orden',
            example: 'Crear orden de trabajo para aire acondicionado en sala de juntas',
            description: 'Genera una nueva orden. Especifica equipo y ubicación.'
        },
        {
            id: 'cmd-status',
            action: 'Verificar Estado',
            example: 'Verificar estado de la orden del ascensor',
            description: 'Consulta el estatus actual de una orden específica.'
        },
        {
            id: 'cmd-list',
            action: 'Listar Pendientes',
            example: 'Listar órdenes pendientes de alta prioridad',
            description: 'Muestra un listado de órdenes filtrarles por prioridad.'
        },
        {
            id: 'cmd-update',
            action: 'Actualizar Prioridad',
            example: 'Actualizar prioridad de orden UMAG-001 a urgente',
            description: 'Modifica la prioridad de una orden existente.'
        },
        {
            id: 'cmd-nav',
            action: 'Navegación',
            example: 'Ir al dashboard de métricas',
            description: 'Navega rápidamente a otras secciones de la app.'
        }
    ];

    return (
        <Dialog>
            <DialogTrigger asChild>
                <button
                    title="Ayuda y funcionalidades"
                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                    aria-label="Ver ayuda y funcionalidades"
                >
                    <HelpCircle className="size-5" />
                </button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-lg rounded-xl md:max-w-2xl p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2 border-b bg-muted/10">
                    <div className="flex items-center justify-between mb-2">
                        <DialogTitle className="text-xl">Ayuda del Chat</DialogTitle>
                    </div>
                    <div className="flex p-1 bg-muted/50 rounded-lg">
                        <button
                            onClick={() => setActiveTab('features')}
                            className={cn(
                                "flex-1 text-sm font-medium py-1.5 px-3 rounded-md transition-all",
                                activeTab === 'features'
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Funcionalidades
                        </button>
                        <button
                            onClick={() => setActiveTab('commands')}
                            className={cn(
                                "flex-1 text-sm font-medium py-1.5 px-3 rounded-md transition-all",
                                activeTab === 'commands'
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Comandos de Voz
                        </button>
                    </div>
                </DialogHeader>

                <ScrollArea className="h-[60vh]">
                    <div className="p-6">
                        {activeTab === 'features' ? (
                            <div className="grid gap-4 md:grid-cols-2">
                                {features.map((feature, index) => (
                                    <div
                                        key={index}
                                        className="group relative overflow-hidden flex items-start gap-4 p-4 rounded-xl border bg-gradient-to-br from-card to-white/50 dark:to-white/5 hover:to-accent/50 text-card-foreground shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
                                    >
                                        <div className="relative mt-1 shrink-0">
                                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 p-3 rounded-2xl ring-1 ring-inset ring-primary/10 group-hover:ring-primary/20 transition-all">
                                                <feature.icon className="size-5 text-primary group-hover:scale-110 transition-transform duration-300" />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 min-w-0">
                                            <h4 className="font-semibold text-base leading-tight tracking-tight group-hover:text-primary transition-colors">
                                                {feature.title}
                                            </h4>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed text-balance">
                                                {feature.description}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 mb-6">
                                    <div className="flex gap-3">
                                        <div className="mt-0.5 bg-blue-100 dark:bg-blue-900/40 p-1.5 rounded-full shrink-0 h-fit">
                                            <Command className="size-4 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-sm text-blue-900 dark:text-blue-100 mb-1">
                                                Control por Voz Inteligente
                                            </h4>
                                            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                                                Puedes controlar la aplicación hablando naturalmente. Intenta usar estas frases exactas o variaciones similares.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-3">
                                    {commands.map((cmd) => (
                                        <div
                                            key={cmd.id}
                                            className="group flex flex-col gap-2 p-3 rounded-xl border bg-card hover:bg-accent/5 transition-colors"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    {cmd.action}
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => handleCopy(cmd.example, cmd.id)}
                                                    title="Copiar ejemplo"
                                                >
                                                    {copiedId === cmd.id ? (
                                                        <Check className="size-3 text-green-500" />
                                                    ) : (
                                                        <Copy className="size-3 text-muted-foreground" />
                                                    )}
                                                </Button>
                                            </div>
                                            <code className="text-sm font-medium bg-muted/50 p-2 rounded-md text-primary block">
                                                "{cmd.example}"
                                            </code>
                                            <p className="text-xs text-muted-foreground">
                                                {cmd.description}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter className="p-4 border-t bg-muted/10">
                    <DialogClose asChild>
                        <Button className="w-full sm:w-auto" variant="outline">
                            Cerrar
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
