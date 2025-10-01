import { db } from '@/core/database';
import { prompts, type NewPrompt } from '@/core/schema';
import { EmbeddingService } from '@/services/embedding-service';
import { ContentExtractor } from '@/services/content-extractor';

async function testEmbeddingService() {
  console.log('🧪 Testing Embedding Service\n');

  const embeddingService = new EmbeddingService({
    chunkSize: 500,
    chunkOverlap: 100,
    embeddingDimensions: 3072,
    useMock: true,
  });

  const domainId = 'test-domain.com';

  try {
    // Test 1: Create a test prompt
    console.log('1️⃣ Creating test prompt...');
    const [testPrompt] = await db
      .insert(prompts)
      .values({
        domainId,
        name: 'Test Prompt',
        description: 'A test prompt for embedding generation',
        prompt: `
          This is a test prompt with enough content to generate embeddings.
          It contains multiple sentences to ensure proper chunking.

          The embedding service should:
          - Split this text into chunks
          - Generate mock embeddings for each chunk
          - Store them in the database with proper relationships

          This helps us verify that the entire pipeline works correctly.
        `,
        modelId: 'gpt-3.5-turbo',
        modelProvider: 'openai',
      } satisfies NewPrompt)
      .returning();

    console.log(`   ✅ Created prompt: ${testPrompt?.id}\n`);

    // Test 2: Process and save embeddings
    console.log('2️⃣ Processing prompt content and generating embeddings...');
    const chunks = await embeddingService.processPromptContent(
      domainId,
      testPrompt?.id || '',
      testPrompt?.prompt || ''
    );
    console.log(`   ✅ Generated ${chunks.length} chunks\n`);

    console.log('3️⃣ Saving embeddings to database...');
    await embeddingService.saveEmbeddings(
      domainId,
      testPrompt?.id || '',
      chunks
    );
    console.log(`   ✅ Saved ${chunks.length} embeddings\n`);

    // Test 3: Verify embeddings were saved
    console.log('4️⃣ Verifying embeddings in database...');
    const stats = await embeddingService.getEmbeddingStats(domainId);
    console.log(`   ✅ Total embeddings: ${stats.totalEmbeddings}`);
    console.log(`   ✅ Unique prompts: ${stats.uniquePrompts}\n`);

    // Test 4: Test content extractor
    console.log('5️⃣ Testing content extractor...');
    const contentExtractor = new ContentExtractor();

    const markdownText = await contentExtractor.extractText(
      '# Hello World\n\nThis is **bold** and *italic* text.\n\n[Link](http://example.com)',
      'text/markdown'
    );
    console.log('   ✅ Markdown extraction:', markdownText.substring(0, 50) + '...');

    const htmlText = await contentExtractor.extractText(
      '<html><body><h1>Title</h1><p>Content</p></body></html>',
      'text/html'
    );
    console.log('   ✅ HTML extraction:', htmlText);

    const jsonText = await contentExtractor.extractText(
      '{"name": "Test", "value": 42}',
      'application/json'
    );
    console.log('   ✅ JSON extraction:', jsonText + '\n');

    // Test 5: Reindex
    console.log('6️⃣ Testing reindexing...');
    const chunkCount = await embeddingService.reindexPrompt(
      domainId,
      testPrompt?.id || ''
    );
    console.log(`   ✅ Reindexed ${chunkCount} chunks\n`);

    // Cleanup
    console.log('7️⃣ Cleaning up test data...');
    await embeddingService.deleteEmbeddingsForPrompt(
      domainId,
      testPrompt?.id || ''
    );
    await db.delete(prompts).where(eq(prompts.id, testPrompt?.id || ''));
    console.log('   ✅ Cleanup complete\n');

    console.log('✨ All tests passed!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Import eq for cleanup
import { eq } from 'drizzle-orm';

testEmbeddingService();
