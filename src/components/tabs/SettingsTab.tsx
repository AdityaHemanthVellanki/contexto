'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useCanvasStore } from '@/store/useCanvasStore';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsList, 
  TabsTrigger, 
  TabsContent 
} from '@/components/ui/tabs';
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

// Schema for canvas settings validation
const canvasSettingsSchema = z.object({
  gridSize: z.number().min(10).max(100),
  snapToGrid: z.boolean(),
  showMinimap: z.boolean(),
  showControls: z.boolean(),
});

// Schema for appearance settings validation
const appearanceSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  animationsEnabled: z.boolean(),
});

// Schema for API settings validation
const apiSettingsSchema = z.object({
  apiEndpoint: z.string().url().optional().or(z.literal('')),
  defaultModel: z.string().min(1),
});

export default function SettingsTab() {
  const { setTheme, theme } = useTheme();
  const { canvasSettings, updateCanvasSettings } = useCanvasStore();
  
  // Initialize forms with default values
  const canvasForm = useForm({
    resolver: zodResolver(canvasSettingsSchema),
    defaultValues: {
      gridSize: canvasSettings.gridSize,
      snapToGrid: canvasSettings.snapToGrid,
      showMinimap: canvasSettings.showMinimap,
      showControls: canvasSettings.showControls,
    },
  });
  
  const appearanceForm = useForm({
    resolver: zodResolver(appearanceSettingsSchema),
    defaultValues: {
      theme: (theme as 'light' | 'dark' | 'system') || 'system',
      animationsEnabled: true,
    },
  });
  
  const apiForm = useForm({
    resolver: zodResolver(apiSettingsSchema),
    defaultValues: {
      apiEndpoint: process.env.NEXT_PUBLIC_API_ENDPOINT || '',
      defaultModel: 'gpt-4',
    },
  });
  
  // Update form when canvas settings change
  useEffect(() => {
    canvasForm.reset({
      gridSize: canvasSettings.gridSize,
      snapToGrid: canvasSettings.snapToGrid,
      showMinimap: canvasSettings.showMinimap,
      showControls: canvasSettings.showControls,
    });
  }, [canvasSettings, canvasForm]);
  
  // Handle canvas settings form submission
  const onCanvasSubmit = (values: z.infer<typeof canvasSettingsSchema>) => {
    updateCanvasSettings(values);
  };
  
  // Handle appearance settings form submission
  const onAppearanceSubmit = (values: z.infer<typeof appearanceSettingsSchema>) => {
    setTheme(values.theme);
    // Save animation preference to local storage
    localStorage.setItem('animationsEnabled', String(values.animationsEnabled));
  };
  
  // Handle API settings form submission
  const onApiSubmit = (values: z.infer<typeof apiSettingsSchema>) => {
    // Save API settings to local storage
    localStorage.setItem('apiSettings', JSON.stringify(values));
  };
  
  return (
    <div className="h-full overflow-y-auto">
      <h2 className="text-xl font-semibold mb-6">Settings</h2>
      
      <Tabs defaultValue="canvas" className="w-full">
        <TabsList className="mb-4 w-full grid grid-cols-3">
          <TabsTrigger value="canvas">Canvas</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>
        
        {/* Canvas Settings */}
        <TabsContent value="canvas">
          <Card>
            <CardHeader>
              <CardTitle>Canvas Settings</CardTitle>
              <CardDescription>
                Configure the behavior and appearance of the canvas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...canvasForm}>
                <form onSubmit={canvasForm.handleSubmit(onCanvasSubmit)} className="space-y-4">
                  <FormField
                    control={canvasForm.control}
                    name="gridSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grid Size</FormLabel>
                        <div className="flex items-center space-x-4">
                          <Slider
                            value={[field.value]}
                            min={10}
                            max={100}
                            step={5}
                            onValueChange={(value) => field.onChange(value[0])}
                            className="w-full"
                          />
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            className="w-16"
                          />
                        </div>
                        <FormDescription>
                          Adjust the size of the canvas grid (in pixels).
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={canvasForm.control}
                    name="snapToGrid"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div>
                          <FormLabel>Snap to Grid</FormLabel>
                          <FormDescription>
                            Automatically align nodes to the grid when moving them.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={canvasForm.control}
                    name="showMinimap"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div>
                          <FormLabel>Show Minimap</FormLabel>
                          <FormDescription>
                            Display a minimap of the canvas in the corner.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={canvasForm.control}
                    name="showControls"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div>
                          <FormLabel>Show Controls</FormLabel>
                          <FormDescription>
                            Display zoom and pan controls on the canvas.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <Button type="submit" className="w-full">Save Canvas Settings</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Appearance Settings */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize the look and feel of the application.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...appearanceForm}>
                <form onSubmit={appearanceForm.handleSubmit(onAppearanceSubmit)} className="space-y-4">
                  <FormField
                    control={appearanceForm.control}
                    name="theme"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Theme</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a theme" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="dark">Dark</SelectItem>
                            <SelectItem value="system">System</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose the application theme.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={appearanceForm.control}
                    name="animationsEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div>
                          <FormLabel>Enable Animations</FormLabel>
                          <FormDescription>
                            Toggle UI animations and transitions.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <Button type="submit" className="w-full">Save Appearance Settings</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* API Settings */}
        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle>API Settings</CardTitle>
              <CardDescription>
                Configure API endpoints and credentials for Azure OpenAI services.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...apiForm}>
                <form onSubmit={apiForm.handleSubmit(onApiSubmit)} className="space-y-4">
                  <FormField
                    control={apiForm.control}
                    name="apiEndpoint"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom API Endpoint</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://your-azure-openai-resource.openai.azure.com" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Optional: Override the default API endpoint.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={apiForm.control}
                    name="defaultModel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Model</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a model" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="gpt-4">GPT-4</SelectItem>
                            <SelectItem value="gpt-35-turbo">GPT-3.5 Turbo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose the default model for pipeline generation.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  
                  <Button type="submit" className="w-full">Save API Settings</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
