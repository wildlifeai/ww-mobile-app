Eric Provencher's approach to prompting, honed through his work on RepoPrompt and context engineering, emphasizes structure, separation of context from instruction, and highly deliberate context selection.

Below is a template, complete with instructions and underlying tips, designed to guide the prompt creation process using his methods.

***

## Eric Provencher's Context-Engineered Prompt Template

This template is structured to maximize output, particularly for code-related tasks, by separating context blocks using key tags and placing core instructions at the bottom, which Eric found "works really well".

### I. System Preamble / Role Definition

| Element | Instruction / Rationale (Based on Eric's Insights) |
| :--- | :--- |
| **Role and Goal** | Clearly define the model's role (e.g., Senior TypeScript Engineer) and the overall goal of the session. |

### II. Context Block (Mandatory Separation)

Eric’s "biggest technique" is to **separate instructions from context**. He advises using key XML tags to demarcate sections.

| XML Tag Block | Content & Context Engineering Tips |
| :--- | :--- |
| `<FILE_TREE>` | Include the relevant file structure/file tree hierarchy. This gives the model a good idea of what the project is. |
| `<CODE_MAPS>` | Include high-level summaries or architectural diagrams if necessary. |
| `<SELECTED_FILES>` | **Crucial Step:** Only include the specific file content that is relevant to the task. This is done to combat "context rot" by avoiding "spurious info" or "garbage information". |
| **Context Minimisation** | **Tip:** Be highly selective about the files sent over. The model should only receive the files you want it to consider. Relying on summarisation often causes the loss of important information. |
| **Logs** | `<LOGS>`: Include detailed logs related to the problem. Eric notes that language models **"love logs"**. Providing logs helps the model (and the user) understand exactly what is happening. |

### III. Instructions Block (Positioned at the Bottom)

Eric finds it works "really well" to place the instructions **at the bottom**. These instructions should be separated from the file content.

| Element | Instruction / Technique |
| :--- | :--- |
| **Primary Instructions** | Clearly and succinctly state the task (e.g., "Implement feature X by modifying the files provided above. Ensure all changes follow style guides."). |
| **Formatting Requirements** | Specify the required output format (e.g., "Provide the changes using the XML diff block format required by the RepoPrompt tools," or "Output only the modified code blocks, nothing else."). |
| **Duplication Technique** | **Tip:** Eric notes that **duplicating instructions actually helps a lot** sometimes. Consider restating the core command in a different phrasing to reinforce the task. |
| **Agentic Hints (If using Claude/Sonnet)** | If the model is agentic (like Claude), include hints about where to find things, but avoid pre-stuffing the context window too much. |

***

## Prompting Tips and Insights (Based on Eric Provencher's Experience)

Eric's deep insights into context management and LLM behaviour offer guidance on *how* to use the template effectively and manage the conversational flow.

### A. Context Management and Rot

1.  **Avoid Context Rot:** Context rot occurs when bad data, failed tool calls, or mistaken reasoning get embedded in the LLM's short-term memory. The model's attention mechanisms can "glob onto those errors".
2.  **Recovery from Rot:** If the model gets stuck looping over a bad idea, you must **"chop off the rot,"** **"kill out the bad answer,"** and **"redirect it from a higher point"**. This means starting a new conversation thread, for instance, by using `/clear` or opening a new chat window.
3.  **Be Lean:** Avoid giving the model too much context (spurious information). Too much garbage information can lead to context rot.

### B. Model Preference Strategy

Recognize that different models are engineered for different workflows, and tailor your context provision accordingly:

| Model Type | Preference and Technique |
| :--- | :--- |
| **Agentic Models (Claude/Sonnet)** | Claude is engineered to be agentic and **prefers to discover context itself**. Stay minimal and lean at the front of the prompt to give the agent room to fill up the context window as it works. |
| **Reasoning Models (O3/GPT-4)** | O3/GPT-4 needs to be **"spoon-fed a little bit more"** to achieve its best work. It performs better when the user provides the tools and context for it to reason over. |
| **Hybrid Workflow** | The current "secret sauce" is **mixing and matching models**. Use an agentic model (like Claude) as the driver that delegates precise engineering work (using well-assembled context blocks) to a highly capable reasoning model (like O3). |

### C. Efficiency and Learning

1.  **Challenge Token Philosophy:** Eric disputes the philosophy that "more tokens is better". While long context windows help tasks run longer without data degradation, high token usage is often a sign of laziness because the user did not properly plan the task and prompt.
2.  **Pre-Plan the Task:** **Planning your task ahead of time** makes the entire process significantly more efficient for both the engineer and the model. For instance, use a separate model (like O3 in ChatGPT) for initial research and synthesis before engaging the coding agent.
3.  **Learn through Struggle:** New coders should **"struggle a little bit more"** before defaulting to asking an AI. Struggling helps the user understand code flow and debugging, leading directly to the ability to write better prompts and use context more effectively.
4.  **Future Insight (Human in the Loop):** Anticipate workflows evolving toward **"human in the loop tool calls,"** where the model makes a call, the human reviews it, provides input, and then the model uses that feedback to continue, allowing the user to "steer the model as it runs".