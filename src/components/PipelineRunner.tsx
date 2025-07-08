import { useState, useCallback, ChangeEvent } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { getAuth } from 'firebase/auth';
import { Graph } from '@/services/executePipeline';
import ApiClient from '@/lib/apiClient';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

interface PipelineRunnerProps {
  pipeline?: {
    id: string;
    name: string;
    graph: Graph;
  };
  graph?: Graph;
  onResultsChange?: (results: any) => void;
}

/**
 * A reusable component for running pipelines with user prompts
 */
export default function PipelineRunner({ pipeline, graph, onResultsChange }: PipelineRunnerProps) {
  const [user] = useAuthState(getAuth());
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);

  // Use either the provided graph or the one from the pipeline
  const pipelineGraph = graph || pipeline?.graph;
  const pipelineId = pipeline?.id;

  const handleRun = useCallback(async () => {
    // Validate inputs
    if (!pipelineGraph || !prompt.trim()) {
      setError('Both a pipeline and a prompt are required');
      return;
    }

    if (!user) {
      setError('You must be signed in to run pipelines');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);
    setUsage(null);

    try {
      // Call the API to run the pipeline
      const response = await ApiClient.runPipeline(pipelineId || '', pipelineGraph, prompt);
      
      // Update state with results
      setResults(response.result);
      setUsage(response.usageReport);
      
      // Notify parent if callback provided
      if (onResultsChange) {
        onResultsChange(response.result);
      }
    } catch (error) {
      console.error('Error running pipeline:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [pipelineGraph, pipelineId, prompt, user, onResultsChange]);

  const formatResult = (result: any) => {
    if (!result) return null;

    return Array.isArray(result) ? result.map((item, index) => (
      <Box key={index} sx={{ mb: 2 }}>
        <Typography variant="h6">{item.label}</Typography>
        <Typography variant="body1" component="pre" sx={{ 
          whiteSpace: 'pre-wrap', 
          p: 2, 
          bgcolor: 'grey.100', 
          borderRadius: 1 
        }}>
          {typeof item.result === 'string' 
            ? item.result 
            : JSON.stringify(item.result, null, 2)}
        </Typography>
      </Box>
    )) : (
      <Typography variant="body1" component="pre" sx={{ 
        whiteSpace: 'pre-wrap', 
        p: 2, 
        bgcolor: 'grey.100', 
        borderRadius: 1 
      }}>
        {JSON.stringify(result, null, 2)}
      </Typography>
    );
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Pipeline information */}
      {pipeline && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5">{pipeline.name}</Typography>
        </Box>
      )}

      {/* Error message */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Prompt input */}
      <TextField
        label="Enter your prompt"
        multiline
        rows={3}
        variant="outlined"
        fullWidth
        value={prompt}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setPrompt(e.target.value)}
        disabled={isLoading}
        sx={{ mb: 2 }}
      />

      {/* Run button */}
      <Button
        variant="contained"
        color="primary"
        disabled={isLoading || !prompt.trim() || !pipelineGraph || !user}
        onClick={handleRun}
        sx={{ mb: 3 }}
      >
        {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Run Pipeline'}
      </Button>

      {/* Results */}
      {results && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>Results:</Typography>
          {formatResult(results)}
        </Box>
      )}

      {/* Usage information */}
      {usage && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>Usage:</Typography>
          <Typography variant="body2">
            Prompt tokens: {usage.total?.promptTokens || 'N/A'}
          </Typography>
          <Typography variant="body2">
            Completion tokens: {usage.total?.completionTokens || 'N/A'}
          </Typography>
          <Typography variant="body2">
            Total tokens: {(usage.total?.promptTokens || 0) + (usage.total?.completionTokens || 0)}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
