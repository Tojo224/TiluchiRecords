import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { UsersService } from "./users.service";

describe("UsersService", () => {
  const user = {
    id: "user-1",
    email: "user@example.com",
    name: "User",
    phone: null,
    role: "USER",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function createService(prismaOverrides: Record<string, any> = {}) {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue({ ...user, name: "Updated" }),
        ...prismaOverrides,
      },
    };

    return {
      service: new UsersService(prisma as any),
      prisma,
    };
  }

  it("returns the authenticated user profile", async () => {
    const { service, prisma } = createService();

    await expect(service.getProfile("user-1")).resolves.toEqual(user);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it("fails when the profile does not exist", async () => {
    const { service } = createService({
      findUnique: jest.fn().mockResolvedValue(null),
    });

    await expect(service.getProfile("missing-user")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("updates only the editable profile fields", async () => {
    const { service, prisma } = createService();

    await expect(
      service.updateProfile("user-1", {
        name: " Updated ",
        email: "UPDATED@EXAMPLE.COM",
        phone: " +591 70000000 ",
      }),
    ).resolves.toMatchObject({
      name: "Updated",
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        name: "Updated",
        email: "updated@example.com",
        phone: "+591 70000000",
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it("rejects an email already used by another account", async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce({ id: "another-user" });
    const { service } = createService({ findUnique });

    await expect(
      service.updateProfile("user-1", { email: "taken@example.com" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects a password confirmation that does not match", async () => {
    const { service, prisma } = createService();

    await expect(
      service.changePassword("user-1", {
        currentPassword: "Current123!",
        newPassword: "NewPassword123!",
        confirmPassword: "Different123!",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
