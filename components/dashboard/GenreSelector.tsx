"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { GENRES } from "@/lib/genres"

interface GenreSelectorProps {
    value: string;
    onChange: (value: string) => void;
}

export function GenreSelector({ value, onChange }: GenreSelectorProps) {
    const [open, setOpen] = React.useState(false)

    // Normalize value for display if it's custom or not in list?
    // For now we assume value matches something in the list, or we display it as is.

    return (
        <Popover open={open} onOpenChange={setOpen} modal={true}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                >
                    {value
                        ? value
                        : "Select a genre..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search genre..." />
                    <CommandList>
                        <CommandEmpty>No genre found.</CommandEmpty>
                        {GENRES.map((group) => (
                            <CommandGroup key={group.category} heading={group.category}>
                                {group.items.map((genre) => (
                                    <CommandItem
                                        key={genre}
                                        value={genre}
                                        onSelect={() => {
                                            onChange(genre)
                                            setOpen(false)
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === genre ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {genre}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
