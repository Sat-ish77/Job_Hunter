import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { X, MapPin, Building2, Briefcase } from 'lucide-react';
import { US_STATES } from '@/constants/us-states';
import { cn } from '@/lib/utils';

export default function LocationFilter({ 
  selectedStates = [], 
  selectedCities = [], 
  workTypes = [],
  onStatesChange,
  onCitiesChange,
  onWorkTypesChange 
}) {
  const [cityInput, setCityInput] = useState('');
  const [statesOpen, setStatesOpen] = useState(false);

  const handleCityKeyPress = (e) => {
    if (e.key === 'Enter' && cityInput.trim()) {
      e.preventDefault();
      const city = cityInput.trim();
      if (!selectedCities.includes(city)) {
        onCitiesChange([...selectedCities, city]);
      }
      setCityInput('');
    }
  };

  const removeCity = (cityToRemove) => {
    onCitiesChange(selectedCities.filter(c => c !== cityToRemove));
  };

  const toggleState = (state) => {
    if (selectedStates.includes(state)) {
      onStatesChange(selectedStates.filter(s => s !== state));
    } else {
      onStatesChange([...selectedStates, state]);
    }
  };

  const toggleWorkType = (type) => {
    if (workTypes.includes(type)) {
      onWorkTypesChange(workTypes.filter(t => t !== type));
    } else {
      onWorkTypesChange([...workTypes, type]);
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-indigo-600" />
        <h3 className="font-semibold text-slate-900">Location & Work Type</h3>
      </div>

      {/* States Multi-Select */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">States</Label>
        <Popover open={statesOpen} onOpenChange={setStatesOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between"
            >
              {selectedStates.length === 0
                ? "Select states..."
                : `${selectedStates.length} state${selectedStates.length > 1 ? 's' : ''} selected`}
              <MapPin className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput placeholder="Search states..." />
              <CommandList>
                <CommandEmpty>No state found.</CommandEmpty>
                <CommandGroup>
                  {US_STATES.map((state) => (
                    <CommandItem
                      key={state}
                      onSelect={() => toggleState(state)}
                      className="flex items-center gap-2"
                    >
                      <Checkbox
                        checked={selectedStates.includes(state)}
                        onCheckedChange={() => toggleState(state)}
                      />
                      <span>{state}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selectedStates.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {selectedStates.map((state) => (
              <Badge
                key={state}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {state}
                <button
                  onClick={() => toggleState(state)}
                  className="ml-1 hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Cities Tag Input */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Cities</Label>
        <Input
          value={cityInput}
          onChange={(e) => setCityInput(e.target.value)}
          onKeyPress={handleCityKeyPress}
          placeholder="Type city name and press Enter..."
          className="w-full"
        />
        {selectedCities.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {selectedCities.map((city) => (
              <Badge
                key={city}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {city}
                <button
                  onClick={() => removeCity(city)}
                  className="ml-1 hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Work Type Checkboxes */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Work Type</Label>
        <div className="space-y-2">
          {['Onsite', 'Hybrid', 'Remote'].map((type) => (
            <div key={type} className="flex items-center space-x-2">
              <Checkbox
                id={`work-type-${type.toLowerCase()}`}
                checked={workTypes.includes(type)}
                onCheckedChange={() => toggleWorkType(type)}
              />
              <label
                htmlFor={`work-type-${type.toLowerCase()}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {type}
              </label>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

