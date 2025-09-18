# SmythOS Milvus Connector

This connector integrates **Milvus** (a popular open-source vector database) with SmythOS SRE.  
It provides APIs to insert, search, and manage vectors, enabling Retrieval-Augmented Generation (RAG) pipelines directly within SmythOS.

## Features
- ✅ Health check endpoint (`/health`)
- ✅ Insert vectors to Milvus
- ✅ Search vectors by similarity
- ✅ Example Python client for testing

## Setup

### 1. Clone & Install
```bash
cd connectors/smythos-milvus-connector
npm install
