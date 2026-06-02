"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function ExperienceList() {
  const [experiences, setExperiences] = useState([
    { id: "1", role: "Frontend Developer", company: "Tech Corp", startDate: "2020-01", endDate: "Present", description: "Developed scalable UI components." }
  ]);
  const [isOpen, setIsOpen] = useState(false);

  const [formData, setFormData] = useState({ role: "", company: "", startDate: "", endDate: "", description: "" });

  const handleAdd = () => {
    setExperiences([...experiences, { ...formData, id: Date.now().toString() }]);
    setIsOpen(false);
    setFormData({ role: "", company: "", startDate: "", endDate: "", description: "" });
  };

  const handleDelete = (id: string) => {
    setExperiences(experiences.filter(e => e.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold mb-1">Work Experience</h2>
          <p className="text-sm text-muted-foreground">Add your professional experience.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> Add Experience
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Experience</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Job Title</Label>
                <Input value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="bg-muted/50 border-border" placeholder="e.g. Software Engineer" />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} className="bg-muted/50 border-border" placeholder="e.g. Google" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="month" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="bg-muted/50 border-border" />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="month" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} className="bg-muted/50 border-border" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="bg-muted/50 border-border h-24" placeholder="Describe your responsibilities and achievements..." />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsOpen(false)} className="border-border text-foreground">Cancel</Button>
              <Button onClick={handleAdd} className="bg-primary text-primary-foreground hover:bg-primary/90">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {experiences.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted-foreground">
            No work experience added yet.
          </div>
        ) : (
          experiences.map((exp) => (
            <div key={exp.id} className="p-5 rounded-xl border border-border bg-muted/30 group transition-all hover:border-border hover:border-primary/50">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-semibold text-foreground text-lg">{exp.role}</h4>
                  <p className="text-muted-foreground font-medium">{exp.company}</p>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(exp.id)} className="h-8 w-8 text-muted-foreground hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{exp.startDate} - {exp.endDate || "Present"}</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{exp.description}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
