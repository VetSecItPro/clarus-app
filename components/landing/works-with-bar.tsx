"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import { Youtube, FileText, FileUp, Headphones } from "lucide-react"
import { cn } from "@/lib/utils"

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

const contentTypes = [
  { icon: Youtube, title: "YouTube", color: "text-red-400" },
  { icon: Headphones, title: "Podcasts", color: "text-purple-400" },
  { icon: FileText, title: "Articles", color: "text-blue-400" },
  { icon: FileUp, title: "PDFs", color: "text-orange-400" },
  { icon: XIcon, title: "X Posts", color: "text-white/70" },
]

export const WorksWithBar = memo(function WorksWithBar() {
  return (
    <section className="py-8 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3"
        >
          <span className="text-white/30 text-sm font-medium tracking-wide uppercase">
            Works with
          </span>
          {contentTypes.map((type, index) => (
            <motion.div
              key={type.title}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="flex items-center gap-2 text-white/50"
            >
              <type.icon className={cn("w-4 h-4", type.color)} />
              <span className="text-sm">{type.title}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
})
