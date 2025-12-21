/**
 * Payments API - Manage payment requests
 * Admin only for GET/PATCH, User for POST
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

const SUPER_ADMIN_EMAIL = 'ialilham77@gmail.com';

// GET /api/payments - List all payments (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email || session.user.email !== SUPER_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payments = await prisma.paymentRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { name: true, tokens: true },
        },
      },
    });

    return NextResponse.json({ payments });
  } catch (error) {
    console.error('GET /api/payments error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/payments - Create payment request (user)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { package: pkg, amount, proofNote } = await request.json();

    if (!pkg || !amount) {
      return NextResponse.json({ error: 'Package and amount required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create payment request
    const payment = await prisma.paymentRequest.create({
      data: {
        userId: user.id,
        userEmail: session.user.email,
        package: pkg,
        amount,
        proofNote,
        status: 'pending',
      },
    });

    // Update user payment status
    await prisma.user.update({
      where: { id: user.id },
      data: { paymentStatus: 'pending' },
    });

    return NextResponse.json({ success: true, payment }, { status: 201 });
  } catch (error) {
    console.error('POST /api/payments error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH /api/payments - Approve/Reject payment (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email || session.user.email !== SUPER_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentId, action, adminNote } = await request.json();

    if (!paymentId || !action) {
      return NextResponse.json({ error: 'paymentId and action required' }, { status: 400 });
    }

    const payment = await prisma.paymentRequest.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (action === 'approve') {
      // Update payment status
      await prisma.paymentRequest.update({
        where: { id: paymentId },
        data: { status: 'approved', adminNote },
      });

      // Add tokens to user
      const tokensToAdd = parseInt(payment.package, 10);
      await prisma.user.update({
        where: { id: payment.userId },
        data: { 
          tokens: { increment: tokensToAdd },
          paymentStatus: 'active',
        },
      });

      // Log transaction
      await prisma.tokenTransaction.create({
        data: {
          userId: payment.userId,
          amount: tokensToAdd,
          type: 'TOPUP',
          description: `Payment approved: ${payment.package} tokens`,
        },
      });

      return NextResponse.json({ success: true, tokensAdded: tokensToAdd });
    } else if (action === 'reject') {
      await prisma.paymentRequest.update({
        where: { id: paymentId },
        data: { status: 'rejected', adminNote },
      });

      await prisma.user.update({
        where: { id: payment.userId },
        data: { paymentStatus: 'none' },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('PATCH /api/payments error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
