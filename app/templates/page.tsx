"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragOverlay } from "@dnd-kit/core"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
    Film, ShoppingBag, GraduationCap, Share2, Music, Mic, Palette,
    Plus, Save, Search, ChevronLeft, GripVertical, Eye, AlertCircle, CheckCircle2
} from "lucide-react"
import Editor, { Monaco } from "@monaco-editor/react"
import Link from "next/link"
import type { editor } from "monaco-editor"

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

// Tab to prompt key mapping
const tabToPromptKey: Record<string, string> = {
    context_analyzer: "context_analyzer",
    scene_planner: "scene_planner",
    asset_reconciler: "asset_reconciler",
    screenwriter: "screenwriter"
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

// Stored prompts for each step (editable text prompts)
interface StoredPrompts {
    context_analyzer: string
    scene_planner: string
    asset_reconciler: string
    screenwriter: string
}

const defaultPrompts: StoredPrompts = {
    context_analyzer: `Tu es un analyste de contexte vidéo. Analyse ce projet et retourne UNIQUEMENT un JSON avec les valeurs remplies.

TYPE DE VIDÉO: {{video_type}}

ENTRÉES:
- Titre: "{{title}}"
- Pitch: "{{pitch}}"
- Style visuel demandé: "{{visual_style}}"
- Durée cible: {{duration}} secondes
- Tags détectés: {{tags_str}}
- Réponses utilisateur: {{answers_str}}

INSTRUCTIONS:
1. Analyse le pitch pour extraire les personnages, lieux, ton, etc.
2. Fusionne le style visuel (pitch + demandé)
3. Calcule le nombre de scènes suggéré (durée / 15 secondes environ)

RETOURNE CE JSON REMPLI:
{
  "fused_visual_style": "...",
  "tone": "...",
  "pacing": "...",
  "language": "French",
  "target_duration_seconds": {{duration}},
  "suggested_scene_count": ...,
  "key_narrative_elements": ["...", "..."],
  "characters_detected": ["...", "..."],
  "locations_detected": ["...", "..."],
  "narrative_arc_type": "...",
  "target_audience": "...",
  "mood": "..."
}`,
    scene_planner: `Tu es un planificateur de scènes. Crée un plan de scènes pour cette vidéo.

TYPE DE VIDÉO: {{video_type}}

CONTEXTE:
- Style: {{visual_style}}
- Ton: {{tone}}
- Durée TOTALE: {{target_duration}} secondes
- Nombre de scènes suggéré: {{suggested_count}}
- Personnages: {{characters}}
- Lieux: {{locations}}
- Arc narratif: {{narrative_arc}}

CONTRAINTES:
- La somme de toutes les durées DOIT égaler EXACTEMENT {{target_duration}} secondes
- Minimum 5s par scène, maximum 45s par scène

RETOURNE CE JSON REMPLI:
{
  "scene_plan": [
    {"index": 1, "type": "setup", "title_suggestion": "...", "duration_seconds": 20, "purpose": "...", "key_action": "..."},
    ...
  ],
  "total_duration_seconds": {{target_duration}}
}`,
    asset_reconciler: `Tu es un gestionnaire d'assets. Identifie les personnages et lieux nécessaires.

TYPE DE VIDÉO: {{video_type}}
STYLE VISUEL: {{visual_style}}

PERSONNAGES DÉTECTÉS: {{characters}}
LIEUX DÉTECTÉS: {{locations}}

ASSETS EXISTANTS:
{{existing_assets}}

RÈGLES:
- USE: si un asset existant correspond
- CREATE: si l'asset n'existe pas
- JAMAIS créer de doublon

RETOURNE CE JSON REMPLI:
{
  "character_plan": [
    {"role_name": "Nom", "action": "USE|CREATE", "create_prompt": "description si CREATE"}
  ],
  "location_plan": [
    {"role_name": "Lieu", "action": "USE|CREATE", "create_prompt": "description si CREATE"}
  ],
  "object_plan": []
}`,
    screenwriter: `Tu es un scénariste. Écris les scènes détaillées pour cette vidéo.

TYPE: {{video_type}}
TITRE: "{{title}}"
PITCH: "{{pitch}}"
STYLE: {{visual_style}}
TON: {{tone}}
DURÉE TOTALE: {{target_duration}} secondes

PLAN DE SCÈNES À SUIVRE:
{{scene_plan}}

PERSONNAGES DISPONIBLES: {{characters}}
LIEUX DISPONIBLES: {{locations}}

CONTRAINTES:
- Respecte les durées du plan
- Écris en French
- La somme des durées DOIT égaler {{target_duration}}s

RETOURNE CE JSON REMPLI:
{
  "scenes": [
    {"index": 1, "title": "...", "summary": "2-3 phrases", "duration_seconds": 20, "character_names": ["..."], "location_name": "..."},
    ...
  ],
  "total_duration_seconds": {{target_duration}}
}`
}

// Draggable Variable Chip
function DraggableVariable({ variable, onClick }: { variable: Variable, onClick: () => void }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: variable.name,
        data: { variable }
    })

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            onClick={onClick}
            className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full 
                bg-orange-500/20 border border-orange-500/40 
                text-orange-400 text-sm font-mono cursor-grab
                hover:bg-orange-500/30 hover:border-orange-500/60
                transition-all duration-200 select-none
                ${isDragging ? 'opacity-50 scale-95' : ''}
            `}
            title={`${variable.description} - Click to insert`}
        >
            <GripVertical className="h-3 w-3 opacity-50" />
            <span>{"{{" + variable.name + "}}"}</span>
        </div>
    )
}

// Droppable Editor Area
function DroppableEditor({
    content,
    onChange,
    onVariableInsert,
    editorRef
}: {
    content: string
    onChange: (value: string) => void
    onVariableInsert: (varName: string) => void
    editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>
}) {
    const { setNodeRef, isOver } = useDroppable({ id: "editor-drop-zone" })

    const handleEditorMount = (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
        editorRef.current = editor

        // Register custom language tokens for variables
        monaco.languages.register({ id: 'promptlang' })
        monaco.languages.setMonarchTokensProvider('promptlang', {
            tokenizer: {
                root: [
                    [/\{\{[^}]+\}\}/, 'variable'],
                    [/"[^"]*"/, 'string'],
                    [/\d+/, 'number'],
                ]
            }
        })

        monaco.editor.defineTheme('prompt-theme', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'variable', foreground: 'f97316', fontStyle: 'bold' },
                { token: 'string', foreground: '22c55e' },
                { token: 'number', foreground: '60a5fa' },
            ],
            colors: {
                'editor.background': '#0c0a1d',
                'editor.lineHighlightBackground': '#1e1b4b30',
            }
        })

        monaco.editor.setTheme('prompt-theme')
    }

    return (
        <div
            ref={setNodeRef}
            className={`flex-1 overflow-hidden relative transition-all duration-200 ${isOver ? 'ring-2 ring-orange-500 ring-inset' : ''}`}
        >
            {isOver && (
                <div className="absolute inset-0 bg-orange-500/10 z-10 pointer-events-none flex items-center justify-center">
                    <span className="text-orange-400 text-lg font-semibold">Drop to insert variable</span>
                </div>
            )}
            <Editor
                height="100%"
                defaultLanguage="promptlang"
                theme="prompt-theme"
                value={content}
                onChange={(value) => onChange(value || "")}
                onMount={handleEditorMount}
                options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: "on",
                    roundedSelection: true,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: "on",
                    padding: { top: 16 },
                    renderWhitespace: "none",
                }}
            />
        </div>
    )
}

export default function TemplateEditorPage() {
    const [templates, setTemplates] = useState<Template[]>([])
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
    const [prompts, setPrompts] = useState<StoredPrompts>(defaultPrompts)
    const [variables, setVariables] = useState<Record<string, Variable[]>>({})
    const [activeTab, setActiveTab] = useState<keyof StoredPrompts>("context_analyzer")
    const [searchQuery, setSearchQuery] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle")

    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

    // Load templates
    useEffect(() => {
        fetch("http://127.0.0.1:8000/api/templates")
            .then(res => res.json())
            .then(data => {
                setTemplates(data)
                if (data.length > 0 && !selectedTemplate) {
                    const first = data[0]
                    setSelectedTemplate(first)
                    loadPromptsFromTemplate(first.full_template)
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

    // Extract prompts from template
    const loadPromptsFromTemplate = (template: Record<string, unknown>) => {
        const templatePrompts = template.prompts as Record<string, unknown> | undefined
        if (templatePrompts) {
            const newPrompts = { ...defaultPrompts }

            // For each step, check if there's a custom_prompt field
            for (const key of Object.keys(defaultPrompts) as (keyof StoredPrompts)[]) {
                const stepConfig = templatePrompts[key] as Record<string, unknown> | undefined
                if (stepConfig?.custom_prompt && typeof stepConfig.custom_prompt === 'string') {
                    newPrompts[key] = stepConfig.custom_prompt
                }
            }

            setPrompts(newPrompts)
        } else {
            setPrompts(defaultPrompts)
        }
        setHasChanges(false)
    }

    // When template changes, load its prompts
    useEffect(() => {
        if (selectedTemplate) {
            loadPromptsFromTemplate(selectedTemplate.full_template)
        }
    }, [selectedTemplate])

    const handlePromptChange = (value: string) => {
        setPrompts(prev => ({ ...prev, [activeTab]: value }))
        setHasChanges(true)
        setSaveStatus("idle")
    }

    const insertVariable = (varName: string) => {
        const editor = editorRef.current
        if (editor) {
            const selection = editor.getSelection()
            const insertion = `{{${varName}}}`

            if (selection) {
                editor.executeEdits("insert-variable", [{
                    range: selection,
                    text: insertion,
                    forceMoveMarkers: true
                }])
                editor.focus()
            }
        }
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        if (over?.id === "editor-drop-zone" && active.data.current?.variable) {
            const varName = active.data.current.variable.name
            insertVariable(varName)
        }
    }

    const handleSave = async () => {
        if (!selectedTemplate) return
        setIsSaving(true)
        setSaveStatus("idle")

        try {
            // Build updated template with custom prompts
            const updatedTemplate = { ...selectedTemplate.full_template }

            // Ensure prompts object exists
            if (!updatedTemplate.prompts) {
                updatedTemplate.prompts = {}
            }

            const templatePrompts = updatedTemplate.prompts as Record<string, unknown>

            // Save each prompt
            for (const key of Object.keys(prompts) as (keyof StoredPrompts)[]) {
                if (!templatePrompts[key]) {
                    templatePrompts[key] = {}
                }
                (templatePrompts[key] as Record<string, unknown>).custom_prompt = prompts[key]
            }

            const res = await fetch(`http://127.0.0.1:8000/api/templates/${selectedTemplate.slug}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ template: updatedTemplate })
            })

            if (res.ok) {
                setHasChanges(false)
                setSaveStatus("success")

                // Refresh templates
                const updated = await fetch("http://127.0.0.1:8000/api/templates").then(r => r.json())
                setTemplates(updated)
                const refreshed = updated.find((t: Template) => t.slug === selectedTemplate.slug)
                if (refreshed) setSelectedTemplate(refreshed)

                setTimeout(() => setSaveStatus("idle"), 2000)
            } else {
                setSaveStatus("error")
            }
        } catch (e) {
            console.error(e)
            setSaveStatus("error")
        } finally {
            setIsSaving(false)
        }
    }

    const filteredTemplates = templates.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.slug.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const currentVariables = variables[activeTab] || []
    const currentPrompt = prompts[activeTab]

    return (
        <DndContext onDragEnd={handleDragEnd}>
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950">
                {/* Header */}
                <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl sticky top-0 z-50">
                    <div className="max-w-[1800px] mx-auto px-4 h-14 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/ai-console" className="text-white/60 hover:text-white transition-colors">
                                <ChevronLeft className="h-5 w-5" />
                            </Link>
                            <h1 className="text-lg font-semibold text-white">Prompt Editor</h1>
                            {selectedTemplate && (
                                <Badge variant="outline" className="border-purple-500/50 text-purple-400">
                                    {selectedTemplate.name}
                                </Badge>
                            )}
                            {hasChanges && (
                                <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
                                    Unsaved changes
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
                                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 min-w-[100px]"
                            >
                                {saveStatus === "success" ? (
                                    <><CheckCircle2 className="h-4 w-4 mr-1" /> Saved!</>
                                ) : saveStatus === "error" ? (
                                    <><AlertCircle className="h-4 w-4 mr-1" /> Error</>
                                ) : (
                                    <><Save className="h-4 w-4 mr-1" /> {isSaving ? "Saving..." : "Save"}</>
                                )}
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
                                {/* Tabs */}
                                <div className="border-b border-white/10 bg-black/10">
                                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as keyof StoredPrompts)} className="w-full">
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
                                            Variables
                                        </h3>
                                        <p className="text-xs text-white/40 mb-4">
                                            Drag onto editor or click to insert
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {currentVariables.map(v => (
                                                <DraggableVariable
                                                    key={v.name}
                                                    variable={v}
                                                    onClick={() => insertVariable(v.name)}
                                                />
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

                                    {/* Editor */}
                                    <DroppableEditor
                                        content={currentPrompt}
                                        onChange={handlePromptChange}
                                        onVariableInsert={insertVariable}
                                        editorRef={editorRef}
                                    />
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
