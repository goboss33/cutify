"use client"

import { useState, useEffect, useCallback } from "react"
import { DndContext, DragEndEvent, DragOverlay, useDraggable, useDroppable } from "@dnd-kit/core"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Film, ShoppingBag, GraduationCap, Share2, Music, Mic, Palette,
    Plus, Save, Trash2, Search, ChevronLeft, GripVertical, Eye
} from "lucide-react"
import Editor from "@monaco-editor/react"
import Link from "next/link"

// Icon mapping for templates
const iconMap: Record<string, React.ReactNode> = {
    cinematic: <Film className="h-4 w-4" />,
    advertising: <ShoppingBag className="h-4 w-4" />,
    tutorial: <GraduationCap className="h-4 w-4" />,
    social_content: <Share2 className="h-4 w-4" />,
    music: <Music className="h-4 w-4" />,
    podcast: <Mic className="h-4 w-4" />,
    motion_design: <Palette className="h-4 w-4" />,
}

interface Template {
    slug: string
    type: string
    name: string
    description: string
    full_template: Record<string, unknown>
}

interface Variable {
    name: string
    description: string
    example: string
}

// Draggable Variable Chip
function DraggableVariable({ variable }: { variable: Variable }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: variable.name,
        data: { variable }
    })

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full 
                bg-orange-500/20 border border-orange-500/40 
                text-orange-400 text-sm font-mono cursor-grab
                hover:bg-orange-500/30 hover:border-orange-500/60
                transition-all duration-200
                ${isDragging ? 'opacity-50 scale-95' : ''}
            `}
            title={variable.description}
        >
            <GripVertical className="h-3 w-3 opacity-50" />
            <span>{"{{" + variable.name + "}}"}</span>
        </div>
    )
}

export default function TemplateEditorPage() {
    const [templates, setTemplates] = useState<Template[]>([])
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
    const [editedContent, setEditedContent] = useState("")
    const [variables, setVariables] = useState<Record<string, Variable[]>>({})
    const [activeTab, setActiveTab] = useState("context_analyzer")
    const [searchQuery, setSearchQuery] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)

    // Load templates
    useEffect(() => {
        fetch("http://127.0.0.1:8000/api/templates")
            .then(res => res.json())
            .then(data => {
                setTemplates(data)
                if (data.length > 0 && !selectedTemplate) {
                    setSelectedTemplate(data[0])
                    setEditedContent(JSON.stringify(data[0].full_template, null, 2))
                }
            })
            .catch(console.error)
    }, [])

    // Load variables
    useEffect(() => {
        fetch("http://127.0.0.1:8000/api/templates/variables/all")
            .then(res => res.json())
            .then(setVariables)
            .catch(console.error)
    }, [])

    // Update edited content when template changes
    useEffect(() => {
        if (selectedTemplate) {
            setEditedContent(JSON.stringify(selectedTemplate.full_template, null, 2))
            setHasChanges(false)
        }
    }, [selectedTemplate])

    const handleEditorChange = useCallback((value: string | undefined) => {
        if (value !== undefined) {
            setEditedContent(value)
            setHasChanges(true)
        }
    }, [])

    const handleSave = async () => {
        if (!selectedTemplate) return
        setIsSaving(true)
        try {
            const parsed = JSON.parse(editedContent)
            const res = await fetch(`http://127.0.0.1:8000/api/templates/${selectedTemplate.slug}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ template: parsed })
            })
            if (res.ok) {
                setHasChanges(false)
                // Refresh templates
                const updated = await fetch("http://127.0.0.1:8000/api/templates").then(r => r.json())
                setTemplates(updated)
                const refreshed = updated.find((t: Template) => t.slug === selectedTemplate.slug)
                if (refreshed) setSelectedTemplate(refreshed)
            }
        } catch (e) {
            alert("Invalid JSON or save failed")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active } = event
        if (active.data.current?.variable) {
            const varName = active.data.current.variable.name
            const insertion = `{{${varName}}}`
            // Insert at cursor position would require monaco ref
            // For now, copy to clipboard
            navigator.clipboard.writeText(insertion)
        }
    }

    const filteredTemplates = templates.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.slug.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const currentVariables = variables[activeTab] || []

    return (
        <DndContext onDragEnd={handleDragEnd}>
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950">
                {/* Header */}
                <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl sticky top-0 z-50">
                    <div className="max-w-[1800px] mx-auto px-4 h-14 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard" className="text-white/60 hover:text-white transition-colors">
                                <ChevronLeft className="h-5 w-5" />
                            </Link>
                            <h1 className="text-lg font-semibold text-white">Template Editor</h1>
                            {selectedTemplate && (
                                <Badge variant="outline" className="border-purple-500/50 text-purple-400">
                                    {selectedTemplate.name}
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowPreview(!showPreview)}
                                className={showPreview ? "text-green-400" : "text-white/60"}
                            >
                                <Eye className="h-4 w-4 mr-1" />
                                Preview
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={!hasChanges || isSaving}
                                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                            >
                                <Save className="h-4 w-4 mr-1" />
                                {isSaving ? "Saving..." : "Save"}
                            </Button>
                        </div>
                    </div>
                </header>

                <div className="flex h-[calc(100vh-3.5rem)]">
                    {/* Sidebar - Template List */}
                    <aside className="w-64 border-r border-white/10 bg-black/20 flex flex-col">
                        <div className="p-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                                <Input
                                    placeholder="Search templates..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                                />
                            </div>
                        </div>
                        <nav className="flex-1 overflow-y-auto px-2">
                            {filteredTemplates.map(template => (
                                <button
                                    key={template.slug}
                                    onClick={() => setSelectedTemplate(template)}
                                    className={`
                                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1
                                        transition-all duration-200 text-left
                                        ${selectedTemplate?.slug === template.slug
                                            ? 'bg-purple-600/30 text-white border border-purple-500/50'
                                            : 'text-white/70 hover:bg-white/5 hover:text-white'
                                        }
                                    `}
                                >
                                    <span className="text-purple-400">
                                        {iconMap[template.slug] || <Film className="h-4 w-4" />}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{template.name}</div>
                                        <div className="text-xs text-white/40 truncate">{template.description}</div>
                                    </div>
                                </button>
                            ))}
                        </nav>
                        <div className="p-3 border-t border-white/10">
                            <Button variant="outline" size="sm" className="w-full border-dashed border-white/20 text-white/60">
                                <Plus className="h-4 w-4 mr-1" />
                                New Template
                            </Button>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 flex flex-col overflow-hidden">
                        {selectedTemplate ? (
                            <>
                                {/* Tabs for different prompt sections */}
                                <div className="border-b border-white/10 bg-black/10">
                                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                        <TabsList className="h-12 bg-transparent border-0 px-4 justify-start gap-1">
                                            <TabsTrigger
                                                value="context_analyzer"
                                                className="data-[state=active]:bg-purple-600/30 data-[state=active]:text-purple-300"
                                            >
                                                Context Analyzer
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="scene_planner"
                                                className="data-[state=active]:bg-purple-600/30 data-[state=active]:text-purple-300"
                                            >
                                                Scene Planner
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="asset_reconciler"
                                                className="data-[state=active]:bg-purple-600/30 data-[state=active]:text-purple-300"
                                            >
                                                Asset Reconciler
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="screenwriter"
                                                className="data-[state=active]:bg-purple-600/30 data-[state=active]:text-purple-300"
                                            >
                                                Screenwriter
                                            </TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </div>

                                <div className="flex-1 flex overflow-hidden">
                                    {/* Variable Palette */}
                                    <div className="w-72 border-r border-white/10 bg-black/10 p-4 overflow-y-auto">
                                        <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-orange-500" />
                                            Available Variables
                                        </h3>
                                        <p className="text-xs text-white/40 mb-4">
                                            Drag to copy • Click to insert
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {currentVariables.map(v => (
                                                <DraggableVariable key={v.name} variable={v} />
                                            ))}
                                        </div>

                                        {showPreview && (
                                            <div className="mt-6 pt-4 border-t border-white/10">
                                                <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-green-500" />
                                                    Example Values
                                                </h3>
                                                <div className="space-y-2 text-xs">
                                                    {currentVariables.map(v => (
                                                        <div key={v.name} className="flex flex-col">
                                                            <span className="text-orange-400 font-mono">{"{{" + v.name + "}}"}</span>
                                                            <span className="text-green-400/80 pl-2">→ {v.example}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Monaco Editor */}
                                    <div className="flex-1 overflow-hidden">
                                        <Editor
                                            height="100%"
                                            defaultLanguage="json"
                                            theme="vs-dark"
                                            value={editedContent}
                                            onChange={handleEditorChange}
                                            options={{
                                                minimap: { enabled: false },
                                                fontSize: 14,
                                                lineNumbers: "on",
                                                roundedSelection: true,
                                                scrollBeyondLastLine: false,
                                                automaticLayout: true,
                                                tabSize: 2,
                                                wordWrap: "on",
                                                padding: { top: 16 }
                                            }}
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-white/40">
                                Select a template to edit
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </DndContext>
    )
}
