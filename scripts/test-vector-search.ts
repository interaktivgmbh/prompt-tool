import { db } from '@/core/database';
import { prompts, type NewPrompt } from '@/core/schema';
import { eq } from 'drizzle-orm';
import { EmbeddingService } from '@/services/embedding-service';
import { VectorSearchService } from '@/services/vector-search-service';

async function testVectorSearch() {
  console.log('🔍 Testing Vector Search Service\n');

  const embeddingService = new EmbeddingService({
    chunkSize: 500,
    chunkOverlap: 100,
    useMock: true,
  });

  const searchService = new VectorSearchService({
    useMock: true,
  });

  const domainId = 'test-domain.com';

  try {
    // Create test prompts with different content
    console.log('1️⃣ Creating test prompts...');

    const prompt1Data: NewPrompt = {
      domainId,
      name: 'Customer Support Bot',
      description: 'Helps users with common questions',
      prompt: `
        You are a helpful customer support assistant.
        Your role is to answer customer questions about products and services.
        Be polite, professional, and provide accurate information.
        If you don't know the answer, direct them to human support.
      `,
      modelId: 'gpt-3.5-turbo',
    };

    const prompt2Data: NewPrompt = {
      domainId,
      name: 'Code Review Assistant',
      description: 'Reviews code for best practices',
      prompt: `
        You are a code review assistant specializing in TypeScript and JavaScript.
        Analyze code for bugs, performance issues, and maintainability.
        Suggest improvements and follow industry best practices.
        Provide constructive feedback with examples.
      `,
      modelId: 'gpt-4',
    };

    const prompt3Data: NewPrompt = {
      domainId,
      name: 'Email Writer',
      description: 'Composes professional emails',
      prompt: `
        You are an expert email writer.
        Compose clear, professional, and effective emails.
        Adapt tone based on context: formal for business, friendly for casual.
        Keep messages concise and actionable.
      `,
      modelId: 'gpt-3.5-turbo',
    };

    const [prompt1] = await db.insert(prompts).values(prompt1Data).returning();
    const [prompt2] = await db.insert(prompts).values(prompt2Data).returning();
    const [prompt3] = await db.insert(prompts).values(prompt3Data).returning();

    console.log(`   ✅ Created 3 test prompts\n`);

    // Generate embeddings for all prompts
    console.log('2️⃣ Generating embeddings for all prompts...');

    for (const prompt of [prompt1, prompt2, prompt3]) {
      const chunks = await embeddingService.processPromptContent(
        domainId,
        prompt?.id || '',
        prompt?.prompt || ''
      );
      await embeddingService.saveEmbeddings(domainId, prompt?.id || '', chunks);
    }

    const stats = await searchService.getEmbeddingStats(domainId);
    console.log(`   ✅ Generated embeddings for ${stats.promptsWithEmbeddings} prompts`);
    console.log(`   ✅ Total chunks: ${stats.totalEmbeddings}\n`);

    // Test 3: Similarity search across all prompts
    console.log('3️⃣ Testing similarity search with query: "help customers"');
    const searchResults = await searchService.similaritySearch(
      domainId,
      'help customers with their questions',
      { topK: 3 }
    );

    console.log(`   Found ${searchResults.length} results:`);
    searchResults.forEach((result, i) => {
      console.log(`   ${i + 1}. ${result.promptName} (score: ${result.similarityScore.toFixed(3)})`);
      console.log(`      "${result.text.substring(0, 60)}..."`);
    });
    console.log();

    // Test 4: Search within specific prompt
    console.log('4️⃣ Testing search within specific prompt (Code Review)...');
    const promptResults = await searchService.searchWithinPrompt(
      domainId,
      prompt2?.id || '',
      'find bugs and performance issues',
      2
    );

    console.log(`   Found ${promptResults.length} chunks in Code Review prompt:`);
    promptResults.forEach((result, i) => {
      console.log(`   ${i + 1}. Score: ${result.similarityScore.toFixed(3)}`);
      console.log(`      "${result.text.substring(0, 60)}..."`);
    });
    console.log();

    // Test 5: Find related prompts
    console.log('5️⃣ Testing related prompts search for "write professional content"...');
    const relatedPrompts = await searchService.findRelatedPrompts(
      domainId,
      'write professional content',
      { topK: 3, minSimilarity: 0.0 }
    );

    console.log(`   Found ${relatedPrompts.length} related prompts:`);
    relatedPrompts.forEach((related, i) => {
      console.log(
        `   ${i + 1}. ${related.promptName} (max similarity: ${related.maxSimilarity.toFixed(3)})`
      );
      console.log(`      Chunks: ${related.chunkCount}`);
      console.log(`      Best match: "${related.bestChunk.substring(0, 60)}..."`);
    });
    console.log();

    // Test 6: Get context for RAG
    console.log('6️⃣ Testing context retrieval for RAG...');
    const context = await searchService.getPromptContext(
      domainId,
      prompt1?.id || '',
      'how to handle customer complaints',
      2
    );

    console.log(`   Retrieved context (${context.length} characters):`);
    console.log(`   "${context.substring(0, 100)}..."\n`);

    // Test 7: Statistics
    console.log('7️⃣ Getting embedding statistics...');
    const finalStats = await searchService.getEmbeddingStats(domainId);
    console.log(`   Total embeddings: ${finalStats.totalEmbeddings}`);
    console.log(`   Prompts with embeddings: ${finalStats.promptsWithEmbeddings}`);
    console.log(`   Average chunk length: ${finalStats.averageChunkLength} chars\n`);

    // Cleanup
    console.log('8️⃣ Cleaning up test data...');
    for (const prompt of [prompt1, prompt2, prompt3]) {
      await embeddingService.deleteEmbeddingsForPrompt(domainId, prompt?.id || '');
      await db.delete(prompts).where(eq(prompts.id, prompt?.id || ''));
    }
    console.log('   ✅ Cleanup complete\n');

    console.log('✨ All vector search tests passed!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testVectorSearch();
