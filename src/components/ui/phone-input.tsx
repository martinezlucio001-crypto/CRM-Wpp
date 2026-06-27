"use client";

import * as React from "react";
import { Input } from "./input";

const COUNTRIES = [
  { code: "BR", ddi: "+55", flag: "🇧🇷", name: "Brasil" },
  { code: "US", ddi: "+1", flag: "🇺🇸", name: "Estados Unidos" },
  { code: "PT", ddi: "+351", flag: "🇵🇹", name: "Portugal" },
  { code: "ES", ddi: "+34", flag: "🇪🇸", name: "Espanha" },
  { code: "AR", ddi: "+54", flag: "🇦🇷", name: "Argentina" },
  { code: "UY", ddi: "+598", flag: "🇺🇾", name: "Uruguai" },
  { code: "PY", ddi: "+595", flag: "🇵🇾", name: "Paraguai" },
  { code: "CL", ddi: "+56", flag: "🇨🇱", name: "Chile" },
  { code: "CO", ddi: "+57", flag: "🇨🇴", name: "Colômbia" },
  { code: "PE", ddi: "+51", flag: "🇵🇪", name: "Peru" },
  { code: "VE", ddi: "+58", flag: "🇻🇪", name: "Venezuela" },
  { code: "EC", ddi: "+593", flag: "🇪🇨", name: "Equador" },
  { code: "BO", ddi: "+591", flag: "🇧🇴", name: "Bolívia" },
  { code: "MX", ddi: "+52", flag: "🇲🇽", name: "México" },
  { code: "GB", ddi: "+44", flag: "🇬🇧", name: "Reino Unido" },
  { code: "FR", ddi: "+33", flag: "🇫🇷", name: "França" },
  { code: "DE", ddi: "+49", flag: "🇩🇪", name: "Alemanha" },
  { code: "IT", ddi: "+39", flag: "🇮🇹", name: "Itália" },
  { code: "CH", ddi: "+41", flag: "🇨🇭", name: "Suíça" },
  { code: "JP", ddi: "+81", flag: "🇯🇵", name: "Japão" },
  { code: "CN", ddi: "+86", flag: "🇨🇳", name: "China" },
  { code: "CA", ddi: "+1", flag: "🇨🇦", name: "Canadá" },
  { code: "AU", ddi: "+61", flag: "🇦🇺", name: "Austrália" },
  { code: "NZ", ddi: "+64", flag: "🇳🇿", name: "Nova Zelândia" },
  { code: "AO", ddi: "+244", flag: "🇦🇴", name: "Angola" },
  { code: "MZ", ddi: "+258", flag: "🇲🇿", name: "Moçambique" },
  { code: "CV", ddi: "+238", flag: "🇨🇻", name: "Cabo Verde" },
  { code: "GW", ddi: "+245", flag: "🇬🇼", name: "Guiné-Bissau" },
  { code: "ST", ddi: "+239", flag: "🇸🇹", name: "São Tomé e Príncipe" },
  { code: "TL", ddi: "+670", flag: "🇹🇱", name: "Timor-Leste" },
  { code: "IE", ddi: "+353", flag: "🇮🇪", name: "Irlanda" },
  { code: "NL", ddi: "+31", flag: "🇳🇱", name: "Holanda" },
  { code: "BE", ddi: "+32", flag: "🇧🇪", name: "Bélgica" },
];

function formatBrazilPhone(value: string): string {
  const clean = value.replace(/\D/g, "").substring(0, 11);
  let formatted = "";
  if (clean.length > 0) {
    const ddd = clean.substring(0, 2);
    formatted += "(" + ddd;
    if (clean.length > 2) {
      formatted += ") ";
      const part1 = clean.substring(2, 7);
      formatted += part1;
      if (clean.length > 7) {
        const part2 = clean.substring(7, 11);
        formatted += "-" + part2;
      }
    }
  }
  return formatted;
}

function parseValue(value: string) {
  let cleaned = value.trim();
  if (!cleaned) {
    return { ddi: "+55", number: "" };
  }

  const hasPlus = cleaned.startsWith("+");
  const normalized = hasPlus ? cleaned : "+" + cleaned;

  const sortedCountries = [...COUNTRIES].sort((a, b) => b.ddi.length - a.ddi.length);
  for (const country of sortedCountries) {
    if (normalized.startsWith(country.ddi)) {
      const numberPart = normalized.substring(country.ddi.length).trim();
      return { ddi: country.ddi, number: numberPart };
    }
  }

  return { ddi: "+55", number: cleaned };
}

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
}

export function PhoneInput({
  value,
  onChange,
  onBlur,
  disabled,
  required,
  id,
  className,
}: PhoneInputProps) {
  const { ddi: parsedDdi, number: parsedNumber } = React.useMemo(() => parseValue(value), [value]);

  const [ddi, setDdi] = React.useState(parsedDdi);
  const [number, setNumber] = React.useState(() => {
    if (parsedDdi === "+55") {
      return formatBrazilPhone(parsedNumber);
    }
    return parsedNumber.replace(/\D/g, "");
  });

  // Sync internal state when external value changes
  React.useEffect(() => {
    setDdi(parsedDdi);
    if (parsedDdi === "+55") {
      setNumber(formatBrazilPhone(parsedNumber));
    } else {
      setNumber(parsedNumber.replace(/\D/g, ""));
    }
  }, [parsedDdi, parsedNumber]);

  const handleDdiChange = (newDdi: string) => {
    setDdi(newDdi);
    
    // Normalize current number
    const cleanNumber = number.replace(/\D/g, "");
    let newFormattedNumber = cleanNumber;
    
    if (newDdi === "+55") {
      newFormattedNumber = formatBrazilPhone(cleanNumber);
    }
    
    setNumber(newFormattedNumber);
    onChange(newFormattedNumber ? `${newDdi} ${newFormattedNumber}` : newDdi);
  };

  const handleNumberChange = (val: string) => {
    let cleanVal = val;
    if (ddi === "+55") {
      cleanVal = formatBrazilPhone(val);
    } else {
      cleanVal = val.replace(/\D/g, "");
    }
    setNumber(cleanVal);
    onChange(cleanVal ? `${ddi} ${cleanVal}` : ddi);
  };

  return (
    <div className="flex gap-2">
      <select
        value={ddi}
        onChange={(e) => handleDdiChange(e.target.value)}
        disabled={disabled}
        className="h-8 rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary w-[110px] shrink-0"
      >
        {COUNTRIES.map((c) => (
          <option key={`${c.code}-${c.ddi}`} value={c.ddi}>
            {c.flag} {c.ddi}
          </option>
        ))}
      </select>
      <Input
        id={id}
        value={number}
        onChange={(e) => handleNumberChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        required={required}
        placeholder={ddi === "+55" ? "(11) 99999-9999" : "Número"}
        className={className}
      />
    </div>
  );
}
