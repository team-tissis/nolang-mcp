FROM python:3.12-slim

# Install uv
RUN pip install uv

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Install dependencies
RUN uv sync --frozen

# Expose port
EXPOSE 7310

# Run the HTTP server
CMD ["uv", "run", "nolang-mcp-http"]
