"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { DndContext, DragEndEvent, useDraggable, useDroppable, closestCenter } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    Film, ShoppingBag, GraduationCap, Share2, Music, Mic, Palette,
    Plus, Save, Search, ChevronLeft, GripVertical, Eye, AlertCircle, CheckCircle2,
    Settings, FileText, Trash2, X, Layers, Users, MapPin, Box, Code
} from "lucide-react"
import Editor, { Monaco } from "@monaco-editor/react"
import Link from "next/link"
import type { editor } from "monaco-editor"

// Icon mapping
const iconMap: Record<string, React.ReactNode> = {
    cinematic: <Film className="h-4 w-4" />,
    advertising: <ShoppingBag className="h-4 w-4" />,
    tutorial: <GraduationCap className="h-4 w-4" />,
    social_content: <Share2 className="h-4 w-4" />,
    music: <Music className="h-4 w-4" />,
    podcast: <Mic className="h-4 w-4" />,
    motion_design: <Palette className="h-4 w-4" />,
}

const assetTypeIcons: Record<string, React.ReactNode> = {
    character: <Users className="h-4 w-4" />,
    location: <MapPin className="h-4 w-4" />,
    object: <Box className="h-4 w-4" />,
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

interface SceneType {
    id: string
    name: string
    percentage: number
}

interface StoredPrompts {
    context_analyzer: string
    scene_planner: string
    asset_reconciler: string
    screenwriter: string
}

// Helper function to replace {{variable}} with example values
// Uses [[value]] markers in preview mode so Monaco can highlight them green
function interpolateVariables(content: string, variables: Variable[]): string {
    let result = content
    for (const v of variables) {
        const regex = new RegExp(`\\{\\{${v.name}\\}\\}`, 'g')
        // Wrap with [[ ]] so Monaco tokenizer can detect and color them green
        result = result.replace(regex, `[[${v.example}]]`)
    }
    return result
}

// Default prompts
const defaultPrompts: StoredPrompts = {
    context_analyzer: `Tu es un analyste de contexte vidéo. Analyse ce projet et retourne UNIQUEMENT un JSON avec les valeurs remplies.

TYPE DE VIDÉO: {{video_type}}

ENTRÉES:
- Titre: "{{title}}"
- Pitch: "{{pitch}}"
- Style visuel demandé: "{{visual_style}}"
- Durée cible: {{duration}} secondes

RETOURNE CE JSON REMPLI:
{
  "fused_visual_style": "...",
  "tone": "...",
  "target_duration_seconds": {{duration}},
  "characters_detected": ["...", "..."],
  "locations_detected": ["...", "..."]
}`,
    scene_planner: `Tu es un planificateur de scènes. Crée un plan pour cette vidéo.

Durée TOTALE: {{target_duration}} secondes
Personnages: {{characters}}
Lieux: {{locations}}

RETOURNE CE JSON REMPLI:
{
  "scene_plan": [
    {"index": 1, "type": "setup", "title_suggestion": "...", "duration_seconds": 20}
  ],
  "total_duration_seconds": {{target_duration}}
}`,
    asset_reconciler: `Tu es un gestionnaire d'assets. Identifie les personnages et lieux.

PERSONNAGES DÉTECTÉS: {{characters}}
LIEUX DÉTECTÉS: {{locations}}

RETOURNE CE JSON:
{
  "character_plan": [...],
  "location_plan": [...]
}`,
    screenwriter: `Tu es un scénariste. Écris les scènes détaillées.

TITRE: "{{title}}"
DURÉE: {{target_duration}} secondes

RETOURNE CE JSON:
{
  "scenes": [...]
}`
}

// Sortable Scene Type Item
function SortableSceneType({
    scene,
    onPercentageChange,
    onRemove,
    totalPercentage
}: {
    scene: SceneType
    onPercentageChange: (id: string, value: number) => void
    onRemove: (id: string) => void
    totalPercentage: number
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`
                flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10
                ${isDragging ? 'opacity-50 z-50' : ''}
            `}
        >
            <div {...attributes} {...listeners} className="cursor-grab text-white/40 hover:text-white/60">
                <GripVertical className="h-4 w-4" />
            </div>
            <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white">{scene.name}</span>
                    <span className="text-sm text-purple-400 font-mono">{scene.percentage}%</span>
                </div>
                <Slider
                    value={[scene.percentage]}
                    onValueChange={([value]) => onPercentageChange(scene.id, value)}
                    max={100}
                    min={5}
                    step={5}
                    className="w-full"
                />
            </div>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(scene.id)}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
                <X className="h-4 w-4" />
            </Button>
        </div>
    )
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
    editorRef,
    isPreview = false,
    variables = []
}: {
    content: string
    onChange: (value: string) => void
    editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>
    isPreview?: boolean
    variables?: Variable[]
}) {
    const { setNodeRef, isOver } = useDroppable({ id: "editor-drop-zone" })

    // In preview mode, replace {{variable}} with example values
    const displayContent = isPreview ? interpolateVariables(content, variables) : content

    const handleEditorMount = (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
        editorRef.current = editor

        monaco.languages.register({ id: 'promptlang' })

        // Tokenizer: {{variable}} orange, [[interpolated]] green
        monaco.languages.setMonarchTokensProvider('promptlang', {
            tokenizer: {
                root: [
                    [/\{\{[^}]+\}\}/, 'variable'],      // {{anything}} -> orange
                    [/\[\[[^\]]+\]\]/, 'interpolated'], // [[anything]] -> green (preview)
                ]
            }
        })

        // Edit mode: white text, orange variables
        monaco.editor.defineTheme('prompt-theme', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'variable', foreground: 'f97316', fontStyle: 'bold' },
                { token: 'interpolated', foreground: '22c55e', fontStyle: 'bold' },
            ],
            colors: {
                'editor.background': '#0c0a1d',
                'editor.foreground': '#e2e8f0',  // White text
                'editor.lineHighlightBackground': '#1e1b4b30',
            }
        })

        // Preview mode: white text, green interpolated values
        monaco.editor.defineTheme('prompt-theme-preview', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'variable', foreground: 'f97316', fontStyle: 'bold' },
                { token: 'interpolated', foreground: '22c55e', fontStyle: 'bold' },
            ],
            colors: {
                'editor.background': '#0c0a1d',
                'editor.foreground': '#e2e8f0',  // White text (same as edit mode)
                'editor.lineHighlightBackground': '#1e1b4b30',
            }
        })

        monaco.editor.setTheme(isPreview ? 'prompt-theme-preview' : 'prompt-theme')
    }

    return (
        <div
            ref={setNodeRef}
            className={`flex-1 overflow-hidden relative transition-all duration-200 ${isOver && !isPreview ? 'ring-2 ring-orange-500 ring-inset' : ''}`}
        >
            {isOver && !isPreview && (
                <div className="absolute inset-0 bg-orange-500/10 z-10 pointer-events-none flex items-center justify-center">
                    <span className="text-orange-400 text-lg font-semibold">Drop to insert variable</span>
                </div>
            )}
            {isPreview && (
                <div className="absolute top-2 right-4 z-10">
                    <Badge className="bg-green-600/80 text-white border-0">
                        <Eye className="h-3 w-3 mr-1" />
                        Preview Mode
                    </Badge>
                </div>
            )}
            <Editor
                key={isPreview ? 'preview' : 'edit'}
                height="100%"
                defaultLanguage="promptlang"
                theme={isPreview ? "prompt-theme-preview" : "prompt-theme"}
                value={displayContent}
                onChange={(value) => !isPreview && onChange(value || "")}
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
                    readOnly: isPreview,
                    domReadOnly: isPreview,
                }}
            />
        </div>
    )
}

// Settings Panel Component
function SettingsPanel({
    template,
    sceneTypes,
    setSceneTypes,
    assetTypes,
    setAssetTypes,
    templateName,
    setTemplateName,
    templateDescription,
    setTemplateDescription,
    onAddSceneType
}: {
    template: Template
    sceneTypes: SceneType[]
    setSceneTypes: React.Dispatch<React.SetStateAction<SceneType[]>>
    assetTypes: string[]
    setAssetTypes: React.Dispatch<React.SetStateAction<string[]>>
    templateName: string
    setTemplateName: (v: string) => void
    templateDescription: string
    setTemplateDescription: (v: string) => void
    onAddSceneType: () => void
}) {
    const [showJson, setShowJson] = useState(false)
    const totalPercentage = sceneTypes.reduce((sum, s) => sum + s.percentage, 0)
    const isBalanced = totalPercentage === 100

    const handlePercentageChange = (id: string, value: number) => {
        setSceneTypes(prev => prev.map(s => s.id === id ? { ...s, percentage: value } : s))
    }

    const handleRemoveSceneType = (id: string) => {
        setSceneTypes(prev => prev.filter(s => s.id !== id))
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (over && active.id !== over.id) {
            setSceneTypes(prev => {
                const oldIndex = prev.findIndex(s => s.id === active.id)
                const newIndex = prev.findIndex(s => s.id === over.id)
                return arrayMove(prev, oldIndex, newIndex)
            })
        }
    }

    const toggleAssetType = (type: string) => {
        setAssetTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        )
    }

    const availableAssetTypes = ["character", "location", "object", "text_overlay", "effect", "logo"]

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Template Info */}
            <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-3">
                    <CardTitle className="text-white flex items-center gap-2">
                        <Film className="h-5 w-5 text-purple-400" />
                        Template Info
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-white/70">Name</Label>
                        <Input
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            className="bg-white/5 border-white/10 text-white"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-white/70">Description</Label>
                        <Input
                            value={templateDescription}
                            onChange={(e) => setTemplateDescription(e.target.value)}
                            className="bg-white/5 border-white/10 text-white"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Scene Structure */}
            <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-white flex items-center gap-2">
                            <Layers className="h-5 w-5 text-purple-400" />
                            Scene Structure
                        </CardTitle>
                        <Badge
                            variant="outline"
                            className={isBalanced ? "border-green-500/50 text-green-400" : "border-yellow-500/50 text-yellow-400"}
                        >
                            {totalPercentage}% / 100%
                        </Badge>
                    </div>
                    <CardDescription className="text-white/50">
                        Drag to reorder • Adjust percentages to balance to 100%
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={sceneTypes.map(s => s.id)} strategy={verticalListSortingStrategy}>
                            {sceneTypes.map(scene => (
                                <SortableSceneType
                                    key={scene.id}
                                    scene={scene}
                                    onPercentageChange={handlePercentageChange}
                                    onRemove={handleRemoveSceneType}
                                    totalPercentage={totalPercentage}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onAddSceneType}
                        className="w-full border-dashed border-white/20 text-white/60 hover:text-white hover:border-white/40"
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Scene Type
                    </Button>
                </CardContent>
            </Card>

            {/* Asset Types */}
            <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-3">
                    <CardTitle className="text-white flex items-center gap-2">
                        <Box className="h-5 w-5 text-purple-400" />
                        Asset Types
                    </CardTitle>
                    <CardDescription className="text-white/50">
                        Select which asset types are used in this video type
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                        {availableAssetTypes.map(type => (
                            <button
                                key={type}
                                onClick={() => toggleAssetType(type)}
                                className={`
                                    flex items-center gap-3 p-3 rounded-lg border transition-all
                                    ${assetTypes.includes(type)
                                        ? 'bg-purple-600/20 border-purple-500/50 text-purple-300'
                                        : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70 hover:border-white/20'
                                    }
                                `}
                            >
                                {assetTypeIcons[type] || <Box className="h-4 w-4" />}
                                <span className="capitalize">{type.replace('_', ' ')}</span>
                                {assetTypes.includes(type) && (
                                    <CheckCircle2 className="h-4 w-4 ml-auto" />
                                )}
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* JSON View for Experts */}
            <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-white flex items-center gap-2">
                            <Code className="h-5 w-5 text-purple-400" />
                            JSON Expert Mode
                        </CardTitle>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowJson(!showJson)}
                            className={showJson ? "text-purple-400" : "text-white/60"}
                        >
                            {showJson ? "Hide" : "Show"}
                        </Button>
                    </div>
                    <CardDescription className="text-white/50">
                        View the raw JSON configuration
                    </CardDescription>
                </CardHeader>
                {showJson && (
                    <CardContent>
                        <pre className="bg-black/40 rounded-lg p-4 overflow-auto max-h-96 text-sm font-mono text-white/80">
                            {JSON.stringify(template.full_template, null, 2)}
                        </pre>
                    </CardContent>
                )}
            </Card>
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
    const [editorMode, setEditorMode] = useState<"prompts" | "settings">("prompts")

    // Settings state
    const [sceneTypes, setSceneTypes] = useState<SceneType[]>([])
    const [assetTypes, setAssetTypes] = useState<string[]>([])
    const [templateName, setTemplateName] = useState("")
    const [templateDescription, setTemplateDescription] = useState("")

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
                    loadFromTemplate(first.full_template)
                }
            })
            .catch(console.error)
    }, [])

    // Load variables based on selected template type
    useEffect(() => {
        const videoType = selectedTemplate?.slug || "cinematic"
        fetch(`http://127.0.0.1:8000/api/templates/variables/${videoType}`)
            .then(res => res.json())
            .then(setVariables)
            .catch(console.error)
    }, [selectedTemplate?.slug])

    const loadFromTemplate = (template: Record<string, unknown>) => {
        // Load prompts
        const templatePrompts = template.prompts as Record<string, unknown> | undefined
        const newPrompts = { ...defaultPrompts }
        if (templatePrompts) {
            for (const key of Object.keys(defaultPrompts) as (keyof StoredPrompts)[]) {
                const stepConfig = templatePrompts[key] as Record<string, unknown> | undefined
                if (stepConfig?.custom_prompt && typeof stepConfig.custom_prompt === 'string') {
                    newPrompts[key] = stepConfig.custom_prompt
                }
            }
        }
        setPrompts(newPrompts)

        // Load settings
        setTemplateName(template.name as string || "")
        setTemplateDescription(template.description as string || "")

        // Load scene structure
        const sceneStructure = template.scene_structure as Record<string, unknown> | undefined
        if (sceneStructure) {
            const types = sceneStructure.types as string[] || []
            const distribution = sceneStructure.distribution as Record<string, number> || {}
            setSceneTypes(types.map((type, i) => ({
                id: `${type}-${i}`,
                name: type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                percentage: Math.round((distribution[type] || 0.2) * 100)
            })))
        }

        // Load asset types
        const assets = template.asset_types as string[] | undefined
        setAssetTypes(assets || ["character", "location"])

        setHasChanges(false)
    }

    useEffect(() => {
        if (selectedTemplate) {
            loadFromTemplate(selectedTemplate.full_template)
        }
    }, [selectedTemplate])

    // Track changes
    useEffect(() => {
        setHasChanges(true)
        setSaveStatus("idle")
    }, [prompts, sceneTypes, assetTypes, templateName, templateDescription])

    const handlePromptChange = (value: string) => {
        setPrompts(prev => ({ ...prev, [activeTab]: value }))
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
            insertVariable(active.data.current.variable.name)
        }
    }

    const addSceneType = () => {
        const newType = prompt("Enter scene type name (e.g., 'transition', 'montage'):")
        if (newType) {
            setSceneTypes(prev => [...prev, {
                id: `${newType}-${Date.now()}`,
                name: newType.replace(/\b\w/g, l => l.toUpperCase()),
                percentage: 10
            }])
        }
    }

    const handleSave = async () => {
        if (!selectedTemplate) return
        setIsSaving(true)
        setSaveStatus("idle")

        try {
            const updatedTemplate = { ...selectedTemplate.full_template }

            // Update metadata
            updatedTemplate.name = templateName
            updatedTemplate.description = templateDescription

            // Update scene structure
            const types = sceneTypes.map(s => s.name.toLowerCase().replace(' ', '_'))
            const distribution: Record<string, number> = {}
            sceneTypes.forEach(s => {
                distribution[s.name.toLowerCase().replace(' ', '_')] = s.percentage / 100
            })
            updatedTemplate.scene_structure = { types, distribution }

            // Update asset types
            updatedTemplate.asset_types = assetTypes

            // Update prompts
            if (!updatedTemplate.prompts) updatedTemplate.prompts = {}
            const templatePrompts = updatedTemplate.prompts as Record<string, unknown>
            for (const key of Object.keys(prompts) as (keyof StoredPrompts)[]) {
                if (!templatePrompts[key]) templatePrompts[key] = {};
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
                const updated = await fetch("http://127.0.0.1:8000/api/templates").then(r => r.json())
                setTemplates(updated)
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
                            <Link href="/debug" className="text-white/60 hover:text-white transition-colors">
                                <ChevronLeft className="h-5 w-5" />
                            </Link>
                            <h1 className="text-lg font-semibold text-white">Template Editor</h1>
                            {selectedTemplate && (
                                <Badge variant="outline" className="border-purple-500/50 text-purple-400">
                                    {selectedTemplate.name}
                                </Badge>
                            )}
                            {hasChanges && (
                                <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
                                    Unsaved
                                </Badge>
                            )}
                        </div>

                        {/* Mode Toggle */}
                        <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditorMode("prompts")}
                                className={editorMode === "prompts" ? "bg-purple-600/30 text-purple-300" : "text-white/60"}
                            >
                                <FileText className="h-4 w-4 mr-1" />
                                Prompts
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditorMode("settings")}
                                className={editorMode === "settings" ? "bg-purple-600/30 text-purple-300" : "text-white/60"}
                            >
                                <Settings className="h-4 w-4 mr-1" />
                                Settings
                            </Button>
                        </div>

                        <div className="flex items-center gap-3">
                            {editorMode === "prompts" && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowPreview(!showPreview)}
                                    className={showPreview ? "text-green-400" : "text-white/60"}
                                >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Preview
                                </Button>
                            )}
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
                    {/* Sidebar */}
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
                            editorMode === "settings" ? (
                                <SettingsPanel
                                    template={selectedTemplate}
                                    sceneTypes={sceneTypes}
                                    setSceneTypes={setSceneTypes}
                                    assetTypes={assetTypes}
                                    setAssetTypes={setAssetTypes}
                                    templateName={templateName}
                                    setTemplateName={setTemplateName}
                                    templateDescription={templateDescription}
                                    setTemplateDescription={setTemplateDescription}
                                    onAddSceneType={addSceneType}
                                />
                            ) : (
                                <>
                                    {/* Tabs */}
                                    <div className="border-b border-white/10 bg-black/10">
                                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as keyof StoredPrompts)} className="w-full">
                                            <TabsList className="h-12 bg-transparent border-0 px-4 justify-start gap-1">
                                                <TabsTrigger value="context_analyzer" className="data-[state=active]:bg-purple-600/30 data-[state=active]:text-purple-300">
                                                    Context Analyzer
                                                </TabsTrigger>
                                                <TabsTrigger value="scene_planner" className="data-[state=active]:bg-purple-600/30 data-[state=active]:text-purple-300">
                                                    Scene Planner
                                                </TabsTrigger>
                                                <TabsTrigger value="asset_reconciler" className="data-[state=active]:bg-purple-600/30 data-[state=active]:text-purple-300">
                                                    Asset Reconciler
                                                </TabsTrigger>
                                                <TabsTrigger value="screenwriter" className="data-[state=active]:bg-purple-600/30 data-[state=active]:text-purple-300">
                                                    Screenwriter
                                                </TabsTrigger>
                                            </TabsList>
                                        </Tabs>
                                    </div>

                                    <div className="flex-1 flex overflow-hidden">
                                        {/* Variable Palette - Grayed out in preview mode */}
                                        <div className={`w-72 border-r border-white/10 bg-black/10 p-4 overflow-y-auto transition-opacity ${showPreview ? 'opacity-40 pointer-events-none' : ''}`}>
                                            <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${showPreview ? 'bg-gray-500' : 'bg-orange-500'}`} />
                                                Variables
                                                {showPreview && <span className="text-xs text-white/40 ml-auto">(disabled)</span>}
                                            </h3>
                                            <p className="text-xs text-white/40 mb-4">
                                                {showPreview ? 'Exit preview to edit' : 'Drag onto editor or click to insert'}
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
                                        </div>

                                        {/* Editor */}
                                        <DroppableEditor
                                            content={currentPrompt}
                                            onChange={handlePromptChange}
                                            editorRef={editorRef}
                                            isPreview={showPreview}
                                            variables={currentVariables}
                                        />
                                    </div>
                                </>
                            )
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
