"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface CircularProgressProps {
    progress: number;
    size?: number;
    strokeWidth?: number;
    className?: string;
    circleClassName?: string;
    progressClassName?: string;
}

export function CircularProgress({
    progress,
    size = 32,
    strokeWidth = 2,
    className,
    circleClassName,
    progressClassName,
}: CircularProgressProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="rotate-[-90deg]"
            >
                {/* Background Circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    className={cn("text-stone-200 dark:text-neutral-800", circleClassName)}
                />
                {/* Progress Circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className={cn(
                        "text-emerald-500 transition-all duration-300 ease-in-out",
                        progressClassName
                    )}
                />
            </svg>
        </div>
    );
}
