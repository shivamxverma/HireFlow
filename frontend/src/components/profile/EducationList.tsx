"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil, Save, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function EducationList() {
  const [educations, setEducations] = useState([
    { id: "1", degree: "B.S. Computer Science", college: "University of Technology", startYear: "2016", endYear: "2020" }
  ]);
  const [isOpen, setIsOpen] = useState(false);

  const [formData, setFormData] = useState({ degree: "", college: "", startYear: "", endYear: "" });

  const handleAdd = () => {
    setEducations([...educations, { ...formData, id: Date.now().toString() }]);
    setIsOpen(false);
    setFormData({ degree: "", college: "", startYear: "", endYear: "" });
  };

  const handleDelete = (id: string) => {
    setEducations(educations.filter(e => e.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold mb-1">Education</h2>
          <p className="text-sm text-muted-foreground">Add your educational background.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> Add Education
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Education</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Degree / Certification</Label>
                <Input value={formData.degree} onChange={e => setFormData({...formData, degree: e.target.value})} className="bg-muted/50 border-border" placeholder="e.g. B.S. Computer Science" />
              </div>
              <div className="space-y-2">
                <Label>College / Institution</Label>
                <Input value={formData.college} onChange={e => setFormData({...formData, college: e.target.value})} className="bg-muted/50 border-border" placeholder="e.g. Stanford University" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Year</Label>
                  <Input value={formData.startYear} onChange={e => setFormData({...formData, startYear: e.target.value})} className="bg-muted/50 border-border" placeholder="2016" />
                </div>
                <div className="space-y-2">
                  <Label>End Year</Label>
                  <Input value={formData.endYear} onChange={e => setFormData({...formData, endYear: e.target.value})} className="bg-muted/50 border-border" placeholder="2020" />
                </div>
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
        {educations.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted-foreground">
            No education entries added yet.
          </div>
        ) : (
          educations.map((edu) => (
            <div key={edu.id} className="p-4 rounded-xl border border-border bg-muted/30 flex justify-between items-start group transition-all hover:border-border hover:border-primary/50">
              <div>
                <h4 className="font-medium text-foreground">{edu.degree}</h4>
                <p className="text-sm text-muted-foreground">{edu.college}</p>
                <p className="text-xs text-muted-foreground mt-1">{edu.startYear} - {edu.endYear || "Present"}</p>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(edu.id)} className="h-8 w-8 text-muted-foreground hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
