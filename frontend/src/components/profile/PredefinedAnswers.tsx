"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function PredefinedAnswers() {
  const [answers, setAnswers] = useState([
    { id: "1", question: "Tell us about yourself", answer: "I am a passionate software engineer with 5 years of experience building scalable web applications. I thrive in dynamic environments and love solving complex problems." },
    { id: "2", question: "Why are you looking for a new opportunity?", answer: "I am looking for a role where I can take on more leadership responsibilities and work with modern cloud architectures." }
  ]);
  const [isOpen, setIsOpen] = useState(false);

  const [formData, setFormData] = useState({ question: "", answer: "" });

  const handleAdd = () => {
    setAnswers([...answers, { ...formData, id: Date.now().toString() }]);
    setIsOpen(false);
    setFormData({ question: "", answer: "" });
  };

  const handleDelete = (id: string) => {
    setAnswers(answers.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold mb-1">Predefined Answers</h2>
          <p className="text-sm text-muted-foreground">Save reusable answers for common application questions.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> Add Answer
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Custom Answer</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Question</Label>
                <Input value={formData.question} onChange={e => setFormData({...formData, question: e.target.value})} className="bg-muted/50 border-border" placeholder="e.g. What are your career goals?" />
              </div>
              <div className="space-y-2">
                <Label>Answer</Label>
                <Textarea value={formData.answer} onChange={e => setFormData({...formData, answer: e.target.value})} className="bg-muted/50 border-border h-32" placeholder="Your reusable answer..." />
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
        {answers.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted-foreground">
            No predefined answers added yet.
          </div>
        ) : (
          answers.map((item) => (
            <div key={item.id} className="p-5 rounded-xl border border-border bg-muted/30 group transition-all hover:border-border hover:border-primary/50">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-foreground text-base">{item.question}</h4>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="h-8 w-8 text-muted-foreground hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{item.answer}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
