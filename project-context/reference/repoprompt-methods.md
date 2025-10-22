Eric Provencher (the founder of RepoPrompt, an application focused on advanced AI coding and context engineering) has developed specific methods, structures, and insights regarding prompting, particularly for large language models (LLMs) used in coding tasks.

Here are Eric's methods, structures, techniques, and tips for creating effective prompts, along with his general insights on prompting and LLM behaviour:

### Eric's Prompt Structure and Techniques

Eric's approach is rooted in **context engineering**, which he is referred to as the "king" of. Context engineering focuses on rearranging and grabbing the necessary context to maximise the output from language models.

**1. Context and Instruction Separation:**
The biggest technique he learned is to **build your prompts in a way that separates instructions from context**.

**2. Prompt Structure and Ordering:**
*   He finds it works really well to place the **instructions at the bottom** of the prompt.
*   Instructions should be separated from the file content.
*   He suggests using **key XML tags** to demarcate sections like the file content being read, code maps, and the file tree.
*   Sometimes, **duplicating instructions actually helps a lot**.

**3. Minimising and Selecting Context:**
*   A crucial step is **selecting the files you want** the model to consider. RepoPrompt was built to allow the user to see the tokens being sent over and rearrange things to get a better response.
*   When giving context, he warns against including "spurious info" (unnecessary details), which he built RepoPrompt to combat. Giving too much garbage information can lead to "context rot".

**4. Techniques for Agentic Models (like Claude):**
*   When dealing with agents, Eric advises letting go of strict control and being more flexible.
*   You must **stay minimal and lean at the front** of the prompt.
*   You should give the agent **hints** about where to find things, but you should **not pre-stuff the context window too much**. This is because the agent will fill up the context window itself with important information as it works.

**5. Utilizing Logs:**
*   Eric notes that language models **"love logs"**.
*   A useful technique is to provide the model with "lots of logs with your problem" to help it understand exactly what is happening.

### Key Insights on Prompting and LLM Behaviour

Eric offers several powerful insights derived from his deep work on context management and RepoPrompt development:

**Context Rot and Recovery:**
*   **Context rot** is a phenomenon where bad data, a failed tool call, or mistaken reasoning gets embedded in the LLM's short-term working memory (context window). Due to the model's attention mechanisms, it will "glob onto those errors" and get stuck on that idea.
*   To fix context rot, you must "chop off the rot," "kill out the bad answer," and "redirect it from a higher point". This usually means starting a new conversation thread (e.g., using `/clear` or opening a new chat window). In applications like Claude Desktop, you can often use features to roll back and "fork the chat" from a point before the error occurred.

**Model Preferences (Context Discovery vs. Spoon-feeding):**
*   **Claude/Sonnet** is engineered for agentic work; it prefers to find what it needs, call tools precisely, and doesn't want to be given too much context initially ("I just want to go find what I need to find").
*   **O3 (GPT-4)**, conversely, needs to be **"spoon-fed a little bit more"** to do its best work. It performs better if the user provides the tools and context for it to reason over.
*   The "secret sauce" right now is finding the best ways to **mix and match these models** (e.g., using Claude as the agent driver that delegates engineering work to O3).

**Efficiency and Token Usage:**
*   Eric challenges the philosophy that "more tokens is better". He notes that relying on summarisation causes the loss of important information.
*   While longer context windows allow tasks to run longer without data degradation, they also increase the risk of context rot.
*   Efficiency matters because tokens are not free. Sometimes burning more tokens does lead to better results, but often, high token usage is a sign that the user is being lazy and avoiding the necessary work of planning tasks and prompts properly.
*   **Planning your task ahead of time** (e.g., using a separate model like O3 in ChatGPT to do initial research and synthesis) makes the entire process ten times more efficient for both the engineer and the model.

**Effective Context Window Limits:**
*   Even though models are advertised with large context windows (e.g., 200K tokens), the quality of the model's response often **degrades when crossing certain thresholds**, sometimes around 32K tokens.
*   The model's own reasoning is often part of the token window allocation, meaning you must reserve space for it. Users must be cautious of every bit of information they provide, as simply filling the context window does not guarantee great results.

**Future Workflow: Human in the Loop:**
*   Eric anticipates that prompting will evolve towards **"human in the loop tool calls"**.
*   In this workflow, the model makes a tool call, the human reviews it, provides input or thoughts, and the model uses that feedback to keep going. This allows the user to "steer the model as it runs".

**Learning and Struggle:**
*   Eric advises that new coders should **"struggle a little bit more"** before defaulting to asking an AI model to solve problems.
*   This struggling process helps the user understand the code flow, debug more easily, and, critically, enables them to **write better prompts** and use better context when they eventually turn to the AI.