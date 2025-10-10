#!/usr/bin/env bun

// SPDX-License-Identifier: Apache-2.0
// Copyright 2025 Interaktiv GmbH

/**
 * Test script to verify PDF extraction functionality
 */

import { ContentExtractor } from '../src/services/content-extractor';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function testPDFExtraction() {
  console.log('🧪 Testing PDF Extraction Functionality\n');
  console.log('=' .repeat(50));

  const contentExtractor = new ContentExtractor();

  try {
    // Test with the sample PDF file
    const pdfPath = join(process.cwd(), 'Mathematik_Flyer_Web.pdf');
    console.log(`📄 Loading PDF: ${pdfPath}`);

    // Read the PDF file
    const pdfBuffer = await readFile(pdfPath);
    console.log(`✅ PDF loaded, size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

    // Test MIME type detection
    const detectedMime = ContentExtractor.detectMimeType('test.pdf');
    console.log(`🔍 Detected MIME type for .pdf: ${detectedMime}`);

    if (detectedMime !== 'application/pdf') {
      throw new Error(`MIME type detection failed. Expected 'application/pdf', got '${detectedMime}'`);
    }

    // Extract text from PDF
    console.log('\n📖 Extracting text from PDF...');
    const extractedText = await contentExtractor.extractText(pdfBuffer, 'application/pdf');

    // Display results
    console.log(`\n✅ Text extraction successful!`);
    console.log('=' .repeat(50));
    console.log('📊 Extraction Statistics:');
    console.log(`   - Total characters: ${extractedText.length}`);
    console.log(`   - Total words: ${extractedText.split(/\s+/).length}`);
    console.log(`   - Total lines: ${extractedText.split('\n').length}`);

    // Show a preview of the extracted text
    console.log('\n📝 Text Preview (first 500 characters):');
    console.log('-' .repeat(50));
    console.log(extractedText.substring(0, 500) + '...');
    console.log('-' .repeat(50));

    // Test chunking the extracted text
    console.log('\n✂️ Testing text chunking...');
    const { TextChunker } = await import('../src/services/text-chunker');
    const chunker = new TextChunker({ chunkSize: 1000, chunkOverlap: 200 });
    const chunks = chunker.splitText(extractedText);
    console.log(`   - Created ${chunks.length} chunks`);
    console.log(`   - Average chunk size: ${Math.round(chunks.reduce((acc, chunk) => acc + chunk.length, 0) / chunks.length)} characters`);

    console.log('\n✅ All tests passed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testPDFExtraction();