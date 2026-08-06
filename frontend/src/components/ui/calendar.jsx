import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  variant = "default", // default, blue, purple, green, orange, pink
  ...props
}) {
  // Neobrutalismo: colores diferenciados por variante
  const variantStyles = {
    default: {
      bg: "bg-white",
      selected: "bg-indigo-400 text-white border-2 border-slate-900",
      today: "bg-yellow-300 border-2 border-slate-900 font-bold",
      hover: "hover:bg-indigo-100 hover:border-2 hover:border-slate-900"
    },
    blue: {
      bg: "bg-blue-50",
      selected: "bg-blue-500 text-white border-2 border-slate-900",
      today: "bg-cyan-300 border-2 border-slate-900 font-bold",
      hover: "hover:bg-blue-200 hover:border-2 hover:border-slate-900"
    },
    purple: {
      bg: "bg-purple-50",
      selected: "bg-purple-500 text-white border-2 border-slate-900",
      today: "bg-pink-300 border-2 border-slate-900 font-bold",
      hover: "hover:bg-purple-200 hover:border-2 hover:border-slate-900"
    },
    green: {
      bg: "bg-green-50",
      selected: "bg-green-500 text-white border-2 border-slate-900",
      today: "bg-lime-300 border-2 border-slate-900 font-bold",
      hover: "hover:bg-green-200 hover:border-2 hover:border-slate-900"
    },
    orange: {
      bg: "bg-orange-50",
      selected: "bg-orange-500 text-white border-2 border-slate-900",
      today: "bg-amber-300 border-2 border-slate-900 font-bold",
      hover: "hover:bg-orange-200 hover:border-2 hover:border-slate-900"
    },
    pink: {
      bg: "bg-pink-50",
      selected: "bg-pink-500 text-white border-2 border-slate-900",
      today: "bg-rose-300 border-2 border-slate-900 font-bold",
      hover: "hover:bg-pink-200 hover:border-2 hover:border-slate-900"
    }
  };

  const colors = variantStyles[variant] || variantStyles.default;

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4 border-4 border-slate-900 rounded-xl shadow-[8px_8px_0px_0px_rgba(15,23,42,1)]", colors.bg, className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center mb-4",
        caption_label: "text-lg font-black text-slate-900 uppercase tracking-wide",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          "h-9 w-9 bg-white border-2 border-slate-900 rounded-lg p-0 hover:bg-slate-100 transition-all shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:shadow-none"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex gap-1",
        head_cell: "text-slate-900 font-bold w-10 text-sm uppercase",
        row: "flex w-full mt-1 gap-1",
        cell: "relative p-0 text-center text-sm",
        day: cn(
          "h-10 w-10 p-0 font-semibold rounded-lg border-2 border-transparent transition-all",
          colors.hover
        ),
        day_range_start: "day-range-start rounded-l-lg",
        day_range_end: "day-range-end rounded-r-lg",
        day_selected: cn(
          colors.selected,
          "shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]"
        ),
        day_today: colors.today,
        day_outside: "text-slate-400 opacity-50",
        day_disabled: "text-slate-300 opacity-30 cursor-not-allowed",
        day_range_middle: "aria-selected:bg-slate-200 aria-selected:text-slate-900 rounded-none border-y-2 border-slate-900",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("h-5 w-5 text-slate-900", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("h-5 w-5 text-slate-900", className)} {...props} />
        ),
      }}
      {...props} />
  );
}
Calendar.displayName = "Calendar"

export { Calendar }
