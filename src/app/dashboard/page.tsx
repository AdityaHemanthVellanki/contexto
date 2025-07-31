'use client';

import React, { useState, useEffect, FC, Dispatch, SetStateAction } from 'react';
import { UploadIcon, CheckIcon, Spinner } from '../../components/icons/icons';

// Type definitions
interface Tool {
  name: string;
  trigger: string;
  description: string;
}

interface OnboardingData {
  mcpName: string;
  description: string;
  file: File | null;
  context: string;
  tools: Tool[];
}

interface StepIndicatorProps {
  step: number;
  title: string;
  active: boolean;
}

interface Step1Props {
  data: OnboardingData;
  setData: Dispatch<SetStateAction<OnboardingData>>;
  setValidation: Dispatch<SetStateAction<boolean>>;
}

interface Step2Props {
  data: OnboardingData;
  setData: Dispatch<SetStateAction<OnboardingData>>;
}

interface Step3Props {
  data: OnboardingData;
}

const StepIndicator: FC<StepIndicatorProps> = ({ step, title, active }) => (
    <div className={`flex-1 text-center px-2 ${active ? 'text-white' : 'text-gray-500'}`}>
        <div className="relative mb-2">
            <div className="absolute w-full top-1/2 transform -translate-y-1/2">
                <div className={`border-t-2 ${active ? 'border-purple-600' : 'border-gray-700'}`}></div>
            </div>
            <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center text-xl font-bold relative z-10 ${active ? 'bg-purple-600 text-white' : 'bg-gray-800 border-2 border-gray-700'}`}>
                {step}
            </div>
        </div>
        <p className="text-sm font-semibold">{title}</p>
    </div>
);

const Step1: FC<Step1Props> = ({ data, setData, setValidation }) => {
    const [sourceType, setSourceType] = useState('describe');

    useEffect(() => {
        const isValid = !!(data.mcpName && (data.description || data.file));
        setValidation(isValid);
    }, [data, setValidation]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setData({ ...data, file: e.target.files[0], description: '' });
        }
    };

    return (
        <div className="border border-gray-700 bg-gray-900 rounded-lg p-8 animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-6">Step 1: Name your MCP & provide source</h2>
            <div className="mb-6">
                <label htmlFor="mcp-name" className="block text-gray-300 mb-2">MCP Name</label>
                <input 
                    type="text" 
                    id="mcp-name"
                    value={data.mcpName}
                    onChange={(e) => setData({ ...data, mcpName: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-purple-500 focus:border-purple-500"
                    placeholder="My Awesome Assistant"
                />
            </div>

            <div className="mb-4">
                <div className="flex border-b border-gray-700">
                    <button 
                        className={`px-4 py-2 -mb-px font-semibold ${sourceType === 'describe' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400'}`}
                        onClick={() => setSourceType('describe')}
                    >
                        Describe your MCP
                    </button>
                    <button 
                        className={`px-4 py-2 -mb-px font-semibold ${sourceType === 'upload' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400'}`}
                        onClick={() => setSourceType('upload')}
                    >
                        Upload your data
                    </button>
                </div>
            </div>

            {sourceType === 'describe' ? (
                <div>
                    <label htmlFor="description" className="block text-gray-300 mb-2">Describe what this server will do.</label>
                    <textarea 
                        id="description"
                        rows={4}
                        value={data.description}
                        onChange={(e) => setData({ ...data, description: e.target.value, file: null })}
                        className="w-full bg-gray-800 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-purple-500 focus:border-purple-500"
                        placeholder="e.g., A customer support bot that can answer questions about our products..."
                    />
                </div>
            ) : (
                <div>
                    <label className="block text-gray-300 mb-2">Upload your data</label>
                    <div className="flex items-center justify-center w-full">
                        <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:bg-gray-700">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadIcon />
                                <p className="mb-2 text-sm text-gray-400"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                <p className="text-xs text-gray-500">JSON, CSV, TXT, MD, PDF, DOCX, JPG, PNG</p>
                            </div>
                            <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".json,.csv,.txt,.md,.pdf,.docx,.jpg,.png" />
                        </label>
                    </div>
                    {data.file && <p className="text-green-400 mt-2">File selected: {data.file.name}</p>}
                </div>
            )}
        </div>
    );
};

const Step2: FC<Step2Props> = ({ data, setData }) => {
    const addTool = () => {
        setData({ ...data, tools: [...data.tools, { name: '', trigger: '', description: '' }] });
    };

    const removeTool = (index: number) => {
        const newTools = data.tools.filter((_, i) => i !== index);
        setData({ ...data, tools: newTools });
    };

    const handleToolChange = (index: number, field: keyof Tool, value: string) => {
        const newTools = data.tools.map((tool, i) => {
            if (i === index) {
                return { ...tool, [field]: value };
            }
            return tool;
        });
        setData({ ...data, tools: newTools });
    };

    return (
        <div className="border border-gray-700 bg-gray-900 rounded-lg p-8 animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-6">Step 2: Provide extra context & define tools (optional)</h2>
            <div className="mb-6">
                <label htmlFor="context" className="block text-gray-300 mb-2">Additional context or rules for your MCP.</label>
                <textarea 
                    id="context"
                    rows={4}
                    value={data.context}
                    onChange={(e) => setData({ ...data, context: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-purple-500 focus:border-purple-500"
                    placeholder="e.g., Always respond in a friendly and professional tone..."
                />
            </div>

            <div>
                <h3 className="text-lg font-semibold text-white mb-4">Tool command editor</h3>
                {data.tools.length === 0 ? (
                    <p className="text-gray-400">Default tools will be generated later.</p>
                ) : (
                    data.tools.map((tool, index) => (
                        <div key={index} className="bg-gray-800 p-4 rounded-md mb-4 border border-gray-700">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-300 mb-1">Tool name</label>
                                    <input type="text" value={tool.name} onChange={(e) => handleToolChange(index, 'name', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-1 text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-300 mb-1">Command trigger</label>
                                    <input type="text" value={tool.trigger} onChange={(e) => handleToolChange(index, 'trigger', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-1 text-white" placeholder="/summarize" />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-300 mb-1">Description</label>
                                    <input type="text" value={tool.description} onChange={(e) => handleToolChange(index, 'description', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-1 text-white" />
                                </div>
                            </div>
                            <div className="text-right mt-2">
                                <button onClick={() => removeTool(index)} className="text-red-400 hover:text-red-300 text-sm">Remove</button>
                            </div>
                        </div>
                    ))
                )}
                <button onClick={addTool} className="mt-2 text-purple-400 hover:text-purple-300">+ Add another tool</button>
            </div>
        </div>
    );
};

const Step3: FC<Step3Props> = ({ data }) => {
    const [status, setStatus] = useState('packaging'); // packaging, ready, deploying, success
    const [appName, setAppName] = useState('');

    useEffect(() => {
        if (status === 'packaging') {
            const timer = setTimeout(() => setStatus('ready'), 2000);
            return () => clearTimeout(timer);
        }
    }, [status]);

    const handleDeploy = () => {
        setStatus('deploying');
        const generatedAppName = (data.mcpName || 'my-app').toLowerCase().replace(/\s+/g, '-') + '-' + Math.random().toString(36).substring(2, 7);
        setAppName(generatedAppName);
        const timer = setTimeout(() => setStatus('success'), 3000);
        return () => clearTimeout(timer);
    };

    return (
        <div className="border border-gray-700 bg-gray-900 rounded-lg p-8 animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-6">Step 3: Build your MCP & get your VSIX</h2>
            
            {status === 'packaging' && (
                <div className="text-center">
                    <p className="text-lg text-gray-300 mb-4">Packaging MCP...</p>
                    <div className="w-full bg-gray-700 rounded-full h-4">
                        <div className="bg-purple-600 h-4 rounded-full w-1/2 animate-pulse"></div>
                    </div>
                </div>
            )}

            {status === 'ready' && (
                <div className="text-center">
                    <div className="flex items-center justify-center text-2xl text-green-400 mb-4">
                        <CheckIcon />
                        <span>MCP package ready!</span>
                    </div>
                    <button onClick={handleDeploy} className="bg-purple-600 hover:bg-purple-500 text-white rounded-md px-8 py-3 text-lg font-semibold">
                        Deploy to Heroku
                    </button>
                </div>
            )}

            {status === 'deploying' && (
                <div className="text-center">
                     <div className="flex items-center justify-center text-2xl text-white mb-4">
                        <Spinner />
                        <span>Deploying...</span>
                    </div>
                </div>
            )}

            {status === 'success' && (
                <div className="text-center">
                    <div className="flex items-center justify-center text-2xl text-green-400 mb-4">
                        <CheckIcon />
                        <span>Success! Your MCP is live.</span>
                    </div>
                    <p className="text-gray-300 mb-6">https://{appName}.herokuapp.com</p>
                    <a href="#" className="border border-purple-600 text-purple-400 hover:bg-purple-700 hover:text-white rounded-md px-6 py-2">
                        Download VSIX Extension
                    </a>
                </div>
            )}
        </div>
    );
};

const MCPOnboardingFlow: FC = () => {
    const [step, setStep] = useState(1);
    const [data, setData] = useState<OnboardingData>({
        mcpName: '',
        description: '',
        file: null,
        context: '',
        tools: [],
    });
    const [isStep1Valid, setStep1Valid] = useState(false);
    const [error, setError] = useState('');

    const nextStep = () => {
        if (step === 1 && !isStep1Valid) {
            setError('Please provide a name and either a description or a file.');
            return;
        }
        setError('');
        if (step < 3) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return <Step1 data={data} setData={setData} setValidation={setStep1Valid} />;
            case 2:
                return <Step2 data={data} setData={setData} />;
            case 3:
                return <Step3 data={data} />;
            default:
                return null;
        }
    };

    return (
        <div className="bg-black text-gray-100 min-h-screen flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-3xl">
                <div className="flex mb-8">
                    <StepIndicator step={1} title="Name & Source" active={step >= 1} />
                    <StepIndicator step={2} title="Context & Tools" active={step >= 2} />
                    <StepIndicator step={3} title="Build & Deploy" active={step >= 3} />
                </div>

                <div className="relative">
                    {renderStep()}
                </div>

                {error && <p className="text-red-400 text-center mt-4">{error}</p>}

                <div className="flex justify-between items-center mt-8">
                    <button 
                        onClick={prevStep} 
                        disabled={step === 1}
                        className="border border-gray-600 text-gray-300 hover:bg-gray-800 rounded-md px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Back
                    </button>

                    {step < 3 ? (
                        <button 
                            onClick={nextStep} 
                            disabled={step === 1 && !isStep1Valid}
                            className="bg-purple-600 hover:bg-purple-500 text-white rounded-md px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    ) : (
                        <div /> // Placeholder to keep spacing
                    )}
                </div>
            </div>
        </div>
    );
};

export default MCPOnboardingFlow;
