"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function HighlightedText({ text, segments }) {
  const [activeSegment, setActiveSegment] = useState(null)

  // Sort segments by start index to ensure proper rendering
  const sortedSegments = [...segments].sort((a, b) => a.start_idx - b.start_idx)

  // Create an array of text parts with highlighting information
  const textParts = []

  let lastIndex = 0

  sortedSegments.forEach((segment, index) => {
    // Add non-highlighted text before this segment
    if (segment.start_idx > lastIndex) {
      textParts.push({
        text: text.substring(lastIndex, segment.start_idx),
        isHighlighted: false,
      })
    }

    // Add the highlighted segment
    textParts.push({
      text: text.substring(segment.start_idx, segment.end_idx),
      isHighlighted: true,
      segmentIndex: index,
      similarity: segment.similarity,
    })

    lastIndex = segment.end_idx
  })

  // Add any remaining text after the last segment
  if (lastIndex < text.length) {
    textParts.push({
      text: text.substring(lastIndex),
      isHighlighted: false,
    })
  }

  const getHighlightColor = (similarity) => {
    // Color intensity based on similarity score
    if (similarity < 0.3) return "bg-yellow-100 hover:bg-yellow-200"
    if (similarity < 0.5) return "bg-orange-100 hover:bg-orange-200"
    return "bg-red-100 hover:bg-red-200"
  }

  return (
    <Card className="p-4 max-h-96 overflow-y-auto">
      <TooltipProvider>
        <div className="whitespace-pre-wrap text-sm">
          {textParts.map((part, index) =>
            part.isHighlighted ? (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <span
                    className={`cursor-pointer rounded px-0.5 ${getHighlightColor(part.similarity || 0)} ${
                      activeSegment === part.segmentIndex ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setActiveSegment(part.segmentIndex === activeSegment ? null : part.segmentIndex)}
                  >
                    {part.text}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Similarity: {Math.round((part.similarity || 0) * 100)}%</p>
                  <p>Source: {sortedSegments[part.segmentIndex || 0].source_doc_name || "Unknown"}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <span key={index}>{part.text}</span>
            ),
          )}
        </div>
      </TooltipProvider>
    </Card>
  )
}
