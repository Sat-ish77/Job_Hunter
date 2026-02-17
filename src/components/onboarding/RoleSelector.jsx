import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Briefcase, Plus, X } from 'lucide-react';
import { motion } from 'framer-motion';

const SUGGESTED_ROLES = [
  'Software Engineer Intern',
  'Data Engineer Intern',
  'Machine Learning Intern',
  'Data Science Intern',
  'Backend Engineer Intern',
  'Frontend Engineer Intern',
  'Full Stack Intern',
  'DevOps Intern',
  'Product Manager Intern',
  'Research Intern',
  'AI Engineer Intern',
  'Cloud Engineer Intern',
];

export default function RoleSelector({ onComplete, initialData }) {
  const [selectedRoles, setSelectedRoles] = useState(initialData || []);
  const [customRole, setCustomRole] = useState('');

  const toggleRole = (role) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const addCustomRole = () => {
    if (customRole.trim() && !selectedRoles.includes(customRole.trim())) {
      setSelectedRoles(prev => [...prev, customRole.trim()]);
      setCustomRole('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomRole();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="p-6">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-6 h-6 text-indigo-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Target Roles</h2>
          <p className="text-sm text-slate-500 mt-1">
            Select the types of roles you're looking for
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_ROLES.map((role) => (
              <Badge
                key={role}
                variant={selectedRoles.includes(role) ? "default" : "outline"}
                className={`cursor-pointer transition-all ${
                  selectedRoles.includes(role)
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'hover:bg-slate-100'
                }`}
                onClick={() => toggleRole(role)}
              >
                {role}
              </Badge>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Add custom role..."
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={addCustomRole}
              disabled={!customRole.trim()}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {selectedRoles.filter(r => !SUGGESTED_ROLES.includes(r)).length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-slate-500 mb-2">Custom roles:</p>
              <div className="flex flex-wrap gap-2">
                {selectedRoles
                  .filter(r => !SUGGESTED_ROLES.includes(r))
                  .map((role) => (
                    <Badge
                      key={role}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      {role}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRole(role);
                        }}
                        className="ml-1.5 hover:text-red-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
              </div>
            </div>
          )}
        </div>

        <Button
          onClick={() => onComplete(selectedRoles)}
          disabled={selectedRoles.length === 0}
          className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700"
        >
          Continue ({selectedRoles.length} selected)
        </Button>
      </Card>
    </motion.div>
  );
}