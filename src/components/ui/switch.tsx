"use client";
import * as React from "react";
export function Switch(props: React.InputHTMLAttributes<HTMLInputElement>){
  return <input type="checkbox" className="h-5 w-9 cursor-pointer appearance-none rounded bg-gray-300 outline-none transition checked:bg-gray-900" {...props}/>;
}
