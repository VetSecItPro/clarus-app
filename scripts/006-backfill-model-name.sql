UPDATE summaries
    SET model_name = 'anthropic/claude-sonnet-4'
    WHERE model_name IS NULL;
