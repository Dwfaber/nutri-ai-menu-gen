import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function DateRangePicker({ 
  value, 
  onChange, 
  placeholder = "Clique para selecionar período",
  className 
}: DateRangePickerProps) {
  const [date, setDate] = React.useState<DateRange | undefined>()
  const [isOpen, setIsOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value)

  // Sync input value with prop value
  React.useEffect(() => {
    setInputValue(value)
  }, [value])

  // Parse date range from text input
  const parseDateFromText = (text: string): DateRange | undefined => {
    // Try to extract dates from format like "Semana de 27/01 a 31/01/2025"
    const dateMatch = text.match(/(\d{1,2})\/(\d{1,2}).*?(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dateMatch) {
      const [, startDay, startMonth, endDay, endMonth, year] = dateMatch;
      try {
        const startDate = new Date(parseInt(year), parseInt(startMonth) - 1, parseInt(startDay));
        const endDate = new Date(parseInt(year), parseInt(endMonth) - 1, parseInt(endDay));
        return { from: startDate, to: endDate };
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  // Format date range to text
  const formatDateRange = (dateRange: DateRange): string => {
    if (!dateRange.from) return "";
    
    if (!dateRange.to) {
      return `Semana de ${format(dateRange.from, "dd/MM")}`;
    }
    
    const year = format(dateRange.to, "yyyy");
    return `Semana de ${format(dateRange.from, "dd/MM")} a ${format(dateRange.to, "dd/MM")}/${year}`;
  }

  // Handle calendar selection
  const handleDateSelect = (selectedRange: DateRange | undefined) => {
    setDate(selectedRange)
    if (selectedRange?.from && selectedRange?.to) {
      const formattedText = formatDateRange(selectedRange)
      setInputValue(formattedText)
      onChange(formattedText)
      setIsOpen(false)
    }
  }

  // Handle manual text input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange(newValue)
    
    // Try to parse dates from text input
    const parsedDate = parseDateFromText(newValue)
    if (parsedDate) {
      setDate(parsedDate)
    }
  }

  // Parse initial date if value exists
  React.useEffect(() => {
    if (value) {
      const parsedDate = parseDateFromText(value)
      if (parsedDate) {
        setDate(parsedDate)
      }
    }
  }, [])

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Input
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="pr-10"
        />
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setIsOpen(!isOpen)}
            >
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={handleDateSelect}
              numberOfMonths={2}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}